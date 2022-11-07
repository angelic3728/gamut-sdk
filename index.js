import Web3 from "web3";
import { ethers, BigNumber } from "ethers";
import erc20ABI from "./assets/abi/erc20";
import hedgeFactoryABI from "./assets/abi/hedgeFactory";
import poolABI from "./assets/abi/pool";
import routerABI from "./assets/abi/router";
import faucetABI from "./assets/abi/faucet";

export const getTokenBalance = async (provider, tokenAddr, account) => {
  const abi = erc20ABI[0];
  let web3 = new Web3(provider);
  let contract = new web3.eth.Contract(abi, tokenAddr);
  let bal = await contract.methods["balanceOf"](account).call();
  let result = Number(web3.utils.fromWei(bal)).toFixed(2);
  if (Number(result) > 999)
    result = result.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return result;
};

export const getPoolAddress = async (
  provider,
  token1Addr,
  token2Addr,
  contractAddr
) => {
  const abi = hedgeFactoryABI[0];
  let web3 = new Web3(provider);
  let contract = new web3.eth.Contract(abi, contractAddr);
  let result = await contract.methods["getPool"](token1Addr, token2Addr).call();
  return result;
};

export const getPoolData = async (provider, poolAddress) => {
  const abi = poolABI[0];
  let web3 = new Web3(provider);
  let contract = new web3.eth.Contract(abi);
  contract.options.address = poolAddress;
  let result1 = await contract.methods["getPoolTokensAndBalances"]().call();
  let result2 = await contract.methods["getWeights"]().call();
  let result = {
    balances: result1["balances"],
    tokens: result1["tokens"],
    weights: result2,
  };
  return result;
};

export const tokenApproval = async (account, provider, tokenAddr, contractAddr) => {
  const routerAbi = routerABI[0];
  const tokenAbi = erc20ABI[0];
  const decimals = 18;
  let web3 = new Web3(provider);
  let contract = new web3.eth.Contract(routerAbi, contractAddr);
  let tokenContract = new web3.eth.Contract(tokenAbi, tokenAddr);
  // const owner = await contract.methods['owner']().call();
  let remain = await tokenContract.methods["allowance"](
    account,
    contractAddr
  ).call();
  remain = web3.utils.fromWei(remain);
  return remain;
};

export const approveToken = async (
  account,
  provider,
  tokenAddr,
  value,
  contractAddr
) => {
  const tokenAbi = erc20ABI[0];
  let web3 = new Web3(provider);
  let token_contract = new web3.eth.Contract(tokenAbi, tokenAddr);
  try {
    await token_contract.methods["increaseAllowance"](
      contractAddr,
      web3.utils.toWei(value.toString())
    ).send({ from: account });
  } catch(e) {
    console.log(e.message);
  }
  const result = await tokenApproval(account, provider, tokenAddr, contractAddr);
  return result;
};

export const swapTokens = async (
  provider,
  inTokenAddr,
  outTokenAddr,
  amount,
  account,
  limit,
  contractAddr
) => {
  const abi = routerABI[0];
  let web3 = new Web3(provider);

  const wei_amount = web3.utils.toWei(amount.toString());
  const wei_limit = web3.utils.toWei(limit.toString());
  let deadline = new Date().getTime() + 900000;

  let contract = new web3.eth.Contract(abi, contractAddr);
  try {
    await contract.methods["swap"](
      [inTokenAddr, outTokenAddr, wei_amount],
      [account, account],
      wei_limit,
      deadline
    ).send({ from: account });
  } catch(e) {
    console.log(e.message);
  }
};

export const batchSwapTokens = async (
  provider,
  inTokenAddr,
  outTokenAddr,
  middleTokens,
  amount,
  account,
  contractAddr
) => {
  const abi = routerABI[0];
  let web3 = new Web3(provider);
  const wei_amount = web3.utils.toWei(amount.toString());
  let deadline = new Date().getTime() + 900000;

  const funds = [account, account];

  let swaps = [];

  if (middleTokens.length === 1)
    swaps = [
      [0, 1, wei_amount],
      [1, 2, web3.utils.toWei("0")],
    ];
  else
    swaps = [
      [0, 1, wei_amount],
      [1, 2, web3.utils.toWei("0")],
      [2, 3, web3.utils.toWei("0")],
    ];

  let assets = [];

  if (middleTokens.length === 1)
    assets = [inTokenAddr, middleTokens[0]["address"], outTokenAddr];
  else
    assets = [
      inTokenAddr,
      middleTokens[0]["address"],
      middleTokens[1]["address"],
      outTokenAddr,
    ];

  let limits = [];

  if (middleTokens.length === 1)
    limits = [wei_amount, web3.utils.toWei("0"), web3.utils.toWei("0")];
  else
    limits = [
      wei_amount,
      web3.utils.toWei("0"),
      web3.utils.toWei("0"),
      web3.utils.toWei("0"),
    ];

  if (middleTokens) {
    const contract = new web3.eth.Contract(abi, contractAddr);
    try {
      await contract.methods["batchSwap"](
        swaps,
        assets,
        funds,
        limits,
        deadline
      ).send({ from: account });
    } catch(e) {
      console.log(e.message);
    }
  }
};

export const joinPool = async (
  account,
  provider,
  token1Addr,
  token2Addr,
  amount1,
  amount2,
  routerContractAddr,
  factoryContractAddr
) => {
  const abi = routerABI[0];
  let web3 = new Web3(provider);
  const poolAddr = await getPoolAddress(
    provider,
    token1Addr,
    token2Addr,
    factoryContractAddr
  );

  if (poolAddr) {
    const poolData = await getPoolData(provider, poolAddr);
    // debugger;
    let tokenA = "";
    let tokenB = "";
    let amountA = 0;
    let amountB = 0;
    if (poolData["tokens"][0] == token1Addr) {
      tokenA = token1Addr;
      tokenB = token2Addr;
      amountA = amount1;
      amountB = amount2;
    } else {
      tokenA = token2Addr;
      tokenB = token1Addr;
      amountA = amount2;
      amountB = amount1;
    }

    const inAmount = web3.utils.toWei(amountA.toString());
    const inMaxAmount = web3.utils.toWei((amountA * 1.2).toString());
    const outAmount = web3.utils.toWei(amountB.toString());
    const outMaxAmount = web3.utils.toWei((amountB * 1.2).toString());
    // debugger;
    const initUserData = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256[]", "uint256"],
      [
        1,
        //amounts In
        [inAmount, outAmount],
        //minimum amount of Lp tokens you are willing to accept
        web3.utils.toWei("0"),
      ]
    );

    // let token1_contract = new web3.eth.Contract(tokenAbi, token1Addr);
    // await token1_contract.methods['increaseAllowance'](c_address, inAmount).send({from: account});

    // let token2_contract = new web3.eth.Contract(tokenAbi, token2Addr);
    // await token2_contract.methods['increaseAllowance'](c_address, outAmount).send({from: account});
    let contract = new web3.eth.Contract(abi, routerContractAddr);
    try {
      let result = await contract.methods["joinPool"](account, [
        [tokenA, tokenB],
        [inMaxAmount, outMaxAmount],
        initUserData,
      ]).send({ from: account });
    } catch(e) {
      console.log(e.message);
    }
  }
};

export const getPoolBalance = async (account, provider, poolAddr) => {
  const abi = poolABI[0];
  let web3 = new Web3(provider);
  let contract = new web3.eth.Contract(abi);
  contract.options.address = poolAddr;
  const result = await contract.methods["balanceOf"](account).call();
  return web3.utils.fromWei(result);
};

export const getPoolSupply = async (provider, poolAddr) => {
  const abi = poolABI[0];
  let web3 = new Web3(provider);
  let contract = new web3.eth.Contract(abi);
  contract.options.address = poolAddr;
  const result = await contract.methods["totalSupply"]().call();
  return web3.utils.fromWei(result);
};

export const getSwapFeePercent = async (provider, poolAddr, contractAddr) => {
  const abi = poolABI[0];
  let web3 = new Web3(provider);
  let contract = new web3.eth.Contract(abi, contractAddr);
  contract.options.address = poolAddr;
  const result = await contract.methods["getSwapFeePercentage"]().call();
  return web3.utils.fromWei(result) * 100;
};

export const removePool = async (
  account,
  provider,
  poolAddr,
  amount,
  ratio,
  token1Addr,
  token2Addr,
  contractAddr
) => {
  const abi = routerABI[0];
  const tokenAbi = erc20ABI[0];
  const poolAbi = poolABI[0];
  let web3 = new Web3(provider);

  const totalAmount = web3.utils.toWei(amount.toString());
  const tokenRatio = web3.utils.toWei(ratio.toString());

  const initUserData = ethers.utils.defaultAbiCoder.encode(
    ["uint256", "uint256"],
    [totalAmount, tokenRatio]
  );

  let contract = new web3.eth.Contract(abi, contractAddr);
  try {
    let result = await contract.methods["exitPool"](account, [
      [token1Addr, token2Addr],
      [web3.utils.toWei("0.001"), web3.utils.toWei("0.001")],
      initUserData,
    ]).send({ from: account });
  } catch(e) {
    console.log(e.message);
  }
};

export const requestToken = async (account, provider, faucetAddr) => {
  const abi = faucetABI[0];
  let web3 = new Web3(provider);

  let contract = new web3.eth.Contract(abi, faucetAddr);
  await contract.methods["requestTokens"]().send({ from: account });
};

export const allowedToWithdraw = async (account, provider, faucetAddr) => {
  const abi = faucetABI[0];
  let web3 = new Web3(provider);

  let contract = new web3.eth.Contract(abi, faucetAddr);
  let allowed = contract.methods["allowedToWithdraw"](account).call();
  return allowed;
};

export const fromWeiVal = (provider, val) => {
  let web3 = new Web3(provider);
  return web3.utils.fromWei(val);
};

