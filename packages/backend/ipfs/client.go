package ipfs

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	"lucky-scratch/config"
)

type UploadResult struct {
	CID        string
	IPFSURI    string
	GatewayURL string
}

type Client interface {
	UploadFile(ctx context.Context, filename string, mimeType string, data []byte) (UploadResult, error)
	UploadJSON(ctx context.Context, name string, payload any) (UploadResult, error)
}

func NewClient(cfg config.StorageConfig) (Client, error) {
	switch strings.ToLower(strings.TrimSpace(cfg.Provider)) {
	case "":
		return nil, nil
	case "pinata":
		if strings.TrimSpace(cfg.PinataJWT) == "" {
			return nil, fmt.Errorf("IPFS_PINATA_JWT is required when IPFS_PROVIDER=pinata")
		}
		if err := validatePinataAPIBaseURL(cfg.PinataAPIBaseURL); err != nil {
			return nil, err
		}
		return &pinataClient{cfg: cfg, http: &http.Client{}}, nil
	case "kubo":
		return &kuboClient{cfg: cfg, http: &http.Client{}}, nil
	default:
		return nil, fmt.Errorf("unsupported IPFS_PROVIDER %q", cfg.Provider)
	}
}

func validatePinataAPIBaseURL(rawURL string) error {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return fmt.Errorf("IPFS_PINATA_API_BASE_URL must be an absolute Pinata API URL")
	}
	if strings.HasSuffix(strings.ToLower(parsed.Hostname()), ".mypinata.cloud") {
		return fmt.Errorf("IPFS_PINATA_API_BASE_URL must point to the Pinata API, not a gateway domain; use IPFS_GATEWAY_BASE_URL for gateways")
	}
	return nil
}

type pinataClient struct {
	cfg  config.StorageConfig
	http *http.Client
}

type pinataUploadResponse struct {
	IpfsHash string `json:"IpfsHash"`
}

func (c *pinataClient) UploadFile(ctx context.Context, filename string, mimeType string, data []byte) (UploadResult, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	fileWriter, err := writer.CreateFormFile("file", filepath.Base(filename))
	if err != nil {
		return UploadResult{}, err
	}
	if _, err := fileWriter.Write(data); err != nil {
		return UploadResult{}, err
	}

	metadata, _ := json.Marshal(map[string]any{"name": filepath.Base(filename)})
	if err := writer.WriteField("pinataMetadata", string(metadata)); err != nil {
		return UploadResult{}, err
	}
	if err := writer.Close(); err != nil {
		return UploadResult{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.PinataAPIBaseURL+"/pinning/pinFileToIPFS", body)
	if err != nil {
		return UploadResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.PinataJWT)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if mimeType != "" {
		req.Header.Set("X-Upload-Content-Type", mimeType)
	}

	return c.doRequest(req)
}

func (c *pinataClient) UploadJSON(ctx context.Context, name string, payload any) (UploadResult, error) {
	raw, err := json.Marshal(map[string]any{
		"pinataMetadata": map[string]any{"name": name},
		"pinataContent":  payload,
	})
	if err != nil {
		return UploadResult{}, err
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.cfg.PinataAPIBaseURL+"/pinning/pinJSONToIPFS",
		bytes.NewReader(raw),
	)
	if err != nil {
		return UploadResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.PinataJWT)
	req.Header.Set("Content-Type", "application/json")

	return c.doRequest(req)
}

func (c *pinataClient) doRequest(req *http.Request) (UploadResult, error) {
	resp, err := c.http.Do(req)
	if err != nil {
		return UploadResult{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return UploadResult{}, fmt.Errorf("pinata upload failed: %s", strings.TrimSpace(string(body)))
	}

	var payload pinataUploadResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return UploadResult{}, err
	}
	return uploadResult(c.cfg.GatewayBaseURL, payload.IpfsHash), nil
}

type kuboClient struct {
	cfg  config.StorageConfig
	http *http.Client
}

type kuboUploadResponse struct {
	Hash string `json:"Hash"`
}

func (c *kuboClient) UploadFile(ctx context.Context, filename string, _ string, data []byte) (UploadResult, error) {
	return c.upload(ctx, filename, data)
}

func (c *kuboClient) UploadJSON(ctx context.Context, name string, payload any) (UploadResult, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return UploadResult{}, err
	}
	return c.upload(ctx, name, raw)
}

func (c *kuboClient) upload(ctx context.Context, filename string, data []byte) (UploadResult, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	fileWriter, err := writer.CreateFormFile("file", filepath.Base(filename))
	if err != nil {
		return UploadResult{}, err
	}
	if _, err := fileWriter.Write(data); err != nil {
		return UploadResult{}, err
	}
	if err := writer.Close(); err != nil {
		return UploadResult{}, err
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.cfg.KuboAPIURL+"/api/v0/add?pin=true&cid-version=1&quieter=true",
		body,
	)
	if err != nil {
		return UploadResult{}, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.http.Do(req)
	if err != nil {
		return UploadResult{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return UploadResult{}, fmt.Errorf("kubo upload failed: %s", strings.TrimSpace(string(body)))
	}

	var payload kuboUploadResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return UploadResult{}, err
	}
	return uploadResult(c.cfg.GatewayBaseURL, payload.Hash), nil
}

func uploadResult(gatewayBaseURL string, cid string) UploadResult {
	cid = strings.TrimSpace(cid)
	return UploadResult{
		CID:        cid,
		IPFSURI:    "ipfs://" + cid,
		GatewayURL: strings.TrimRight(gatewayBaseURL, "/") + "/" + cid,
	}
}
