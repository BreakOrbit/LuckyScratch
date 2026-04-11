package bindings

import (
	"context"

	gethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
)

type Ticket struct {
	address  common.Address
	contract *bind.BoundContract
}

func NewTicket(address common.Address, parsedABI gethabi.ABI, backend bind.ContractBackend) *Ticket {
	return &Ticket{
		address:  address,
		contract: bind.NewBoundContract(address, parsedABI, backend, backend, backend),
	}
}

func (t *Ticket) Address() common.Address {
	return t.address
}

func (t *Ticket) OwnerOf(ctx context.Context, ticketID uint64) (common.Address, error) {
	var out []interface{}
	err := t.contract.Call(&bind.CallOpts{Context: ctx}, &out, "ownerOf", newBig(ticketID))
	if err != nil {
		return common.Address{}, err
	}
	return *gethabi.ConvertType(out[0], new(common.Address)).(*common.Address), nil
}
