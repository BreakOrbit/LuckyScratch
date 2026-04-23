import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const erc20ABI = [
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
      abi: erc20ABI,
    },
  },
  11155111: {
    CUSDCToken: {
      address: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
      abi: erc20ABI,
    },
  },
} as const satisfies GenericContractsDeclaration;

export default externalContracts;
