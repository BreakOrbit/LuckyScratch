import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const confidentialUsdcABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "confidentialBalanceOf",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "holder", type: "address" },
      { internalType: "address", name: "operator", type: "address" },
    ],
    name: "isOperator",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "operator", type: "address" },
      { internalType: "uint48", name: "until", type: "uint48" },
    ],
    name: "setOperator",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "wrap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const underlyingMockUsdcABI = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const externalContracts = {
  1: {
    CUSDCToken: {
      address: "0xe978F22157048E5DB8E5d07971376e86671672B2",
      abi: confidentialUsdcABI,
    },
  },
  11155111: {
    CUSDCToken: {
      address: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
      abi: confidentialUsdcABI,
    },
    CUSDCUnderlyingToken: {
      address: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF",
      abi: underlyingMockUsdcABI,
    },
  },
} as const satisfies GenericContractsDeclaration;

export default externalContracts;
