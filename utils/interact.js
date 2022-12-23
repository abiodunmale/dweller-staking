import axios from 'axios';
import { Network, Alchemy } from "alchemy-sdk";
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const web3 = createAlchemyWeb3("https://eth-mainnet.g.alchemy.com/v2/5nqfwQxUKe1tO1huQ59XzSC3BZhtzkHc");

const alchemy = new Alchemy({
    apiKey: "5nqfwQxUKe1tO1huQ59XzSC3BZhtzkHc",
    network: Network.ETH_MAINNET
});

//collection config
const nftAbi = require("./abi/erc721.json");
const nftContractAddress = "0xD85fFA2989F6A22A0e76873ca8571Ae24864f76e";
const nftContract = new web3.eth.Contract(nftAbi, nftContractAddress);


//reward config
const tokenABI = require("./abi/token.json");
const tokenContractAddress = "0x4Ce474ef8CD878a2A3F6525BB928D51022F55553";
const tokenContract = new web3.eth.Contract(tokenABI, tokenContractAddress);

//staking config
const stakingABI = require("./abi/staking.json");
const stakingContractAddress = "0xE8Bd0D90546bc035E1e3c46679362c1477B8B8F9";
const stakingContract = new web3.eth.Contract(stakingABI, stakingContractAddress);



export const connectWallet = async () => {
    if (window.ethereum) {
        try {
            const addressArray = await window.ethereum.request({
                method: "eth_requestAccounts",
            });

            const chainId = await window.ethereum.request({ method: 'eth_chainId' });

            if(chainId != "0x1"){
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x1' }],
                });
            }
            
            return {
                success: true,
                status: "Connected",
                address: addressArray[0],
            };
        } catch (err) {
            return {
                success: false,
                address: "",
                status: err.message,
            };
        }
    } else {
        return {
            success: false,
            address: "",
            status: "You must install MetaMask, a virtual Ethereum wallet, in your browser.",
        };
    }
};
  
export const getCurrentWalletConnected = async () => {
    if (window.ethereum) {
        try {
            const addressArray = await window.ethereum.request({
                method: "eth_accounts",
            });

            if (addressArray.length > 0) {

                return {
                    address: addressArray[0],
                    status: "connected",
                    success: true,
                };
            } else {
                return {
                    address: "",
                    status: "Connect your wallet",
                    success: false,
                };
            }
        } catch (err) {
            return {
                address: "",
                status: err.message,
                success: false,
            };
        }
    } else {
        return {
            address: "",
            status: "You must install MetaMask, a virtual Ethereum wallet, in your browser.",
            success: false
        };
    }
};


let response = {
    success: false,
    status: ""
};

//start erc721

export const checkApproval = async (wallectAddress) => {
    const result = await nftContract.methods.isApprovedForAll(wallectAddress, stakingContractAddress).call();
    return result;
};

function secondsToTime(secs){
    var hours = Math.floor(secs / (60 * 60));
   
    var divisor_for_minutes = secs % (60 * 60);
    var minutes = Math.floor(divisor_for_minutes / 60);
 
    var divisor_for_seconds = divisor_for_minutes % 60;
    var seconds = Math.ceil(divisor_for_seconds);

    let duration = "";
    if(hours > 0) duration = hours+ " hour(s)";
    if(minutes > 0) duration = minutes+ " minute(s)"
    // if(hours > 24) duration = hours+ " day(s)"
    
    return duration;
}

export const getTokenInformation = async (wallectAddress) => {
    const stakedIdsArr = await getTokenIdsStaked(wallectAddress);
    let itemArray = [];

    const result = await alchemy.nft.getNftsForOwner(wallectAddress, {
        contractAddresses : [nftContractAddress]
    });

    for (let index = 0; index < result.totalCount; index++) {
        // let justRefresh = await axios.get(`https://eth-goerli.g.alchemy.com/nft/v2/CH1V81ZMzVXNjIFWnRNNTTgY0nD_Twh6/getNFTMetadata?contractAddress=0x7F5683E7d88FEFaad727D38408b863811e128B1b&tokenId=${result.ownedNfts[index].tokenId}&tokenType=ERC721&refreshCache=true`).catch(function (error) {
        //     console.log(error.toJSON());
        // });
        let tokenId = result.ownedNfts[index].tokenId;
        let rawImg = result.ownedNfts[index].rawMetadata.image;
        var name = result.ownedNfts[index].rawMetadata.name;
        let image = rawImg.replace('ipfs://', 'https://ipfs.io/ipfs/');
        itemArray.push({
            name: name,
            img: image,
            tokenId: tokenId,
            staked: false,
        });
    }


    //owned nft token from staking contract
    for (let index = 0; index < stakedIdsArr.length; index++) {
        const rawUriS = await nftContract.methods.tokenURI(stakedIdsArr[index].tokenId).call();
        // console.log("uri", rawUriS);
        let cleanUriS = rawUriS.replace('ipfs://', 'https://ipfs.io/ipfs/');
        let metadataS = await axios.get(`${cleanUriS}`).catch(function (error) {
            console.log(error.toJSON());
        });
        let rawImgS = metadataS.data.image;
        var nameS = metadataS.data.name;
        let imageS = rawImgS.replace('ipfs://', 'https://ipfs.io/ipfs/'); 
        itemArray.push({
            name: nameS,
            img: imageS,
            tokenId: stakedIdsArr[index].tokenId,
            staked: true,
        });        
    }
    itemArray.sort((a, b) => parseFloat(a.tokenId) - parseFloat(b.tokenId));
    return itemArray;
};

export const setApproval = async (wallectAddress) => {
    await nftContract.methods.setApprovalForAll(stakingContractAddress, true)
    .send({
      from: wallectAddress,
      to: nftContractAddress
    })
    .then(function(receipt){
      console.log("receipt: ", receipt);
      response.success = true;
      response.status = "Approved successfully"
    }).catch(function(error){
      console.log("error: ", error);
      response.success = false;
      response.status = "Something went wrong";
    });
  
    return response;
};


export const mintNFT = async (contractAddress, wallectAddress) => {
    await nftContract.methods.publicMint(5)
    .send({
      from: wallectAddress,
      to: contractAddress
    })
    .then(function(receipt){
      console.log("receipt: ", receipt);
      response.success = true;
      response.status = "Mint successfully"
    }).catch(function(error){
      console.log("error: ", error);
      response.success = false;
      response.status = "Something went wrong";
    });
  
    return response;
};

//end erc721


//start erc20


export const getTokenBalance = async (wallectAddress) => {
    const result = await tokenContract.methods.balanceOf(wallectAddress).call();
    const resultEther = web3.utils.fromWei(result, "ether");
    return resultEther;
};


//enderc20



//start staking

export const getEarnings = async (wallectAddress) => {
    const result = await stakingContract.methods.earnings(wallectAddress).call();
    const resultEther = web3.utils.fromWei(result, "ether");
    return resultEther;
};

const getTokenStakedBalance = async (wallectAddress) => {
    const result = await stakingContract.methods.balanceOf(wallectAddress).call();
    return result;
}

const getTokenIdsStaked = async (wallectAddress) => {
    const bal = await getTokenStakedBalance(wallectAddress);
    const resultArr = await stakingContract.methods.tokenOfOwnerStaked(wallectAddress).call();
    let tokens =[];
    for (let index = 0; index < bal; index++) {
        tokens.push({
            tokenId : resultArr[index].tokenId,
            staker: resultArr[index].staker
        })
    }
    return tokens;
};


export const claimReward = async (wallectAddress) => {
    await stakingContract.methods.claimRewards()
    .send({
      from: wallectAddress,
      to: stakingContractAddress
    })
    .then(function(receipt){
      console.log("receipt: ", receipt);
      response.success = true;
      response.status = "Rewards claimed";
    }).catch(function(error){
      console.log("error: ", error);
      response.success = false;
      response.status = "Something went wrong";
    });
    return response;
};

export const stakeNFT = async (token, wallectAddress) => {
    await stakingContract.methods.stake(token)
    .send({
      from: wallectAddress,
      to: stakingContractAddress
    })
    .then(function(receipt){
      console.log("receipt: ", receipt);
      response.success = true;
      response.status = "Staked successfully";
    }).catch(function(error){
      console.log("error: ", error);
      response.success = false;
      response.status = "Something went wrong";
    });
    return response;  
};

export const batchStakeNFT = async (tokens, wallectAddress) => {
    await stakingContract.methods.batchStake(tokens)
    .send({
      from: wallectAddress,
      to: stakingContractAddress
    })
    .then(function(receipt){
      console.log("receipt: ", receipt);
      response.success = true;
      response.status = "Staked successfully";
    }).catch(function(error){
      console.log("error: ", error);
      response.success = false;
      response.status = "Something went wrong";
    });
    return response;  
};

export const unStakeNFT = async (token, wallectAddress) => {
    await stakingContract.methods.unstake(token)
    .send({
      from: wallectAddress,
      to: stakingContractAddress
    })
    .then(function(receipt){
      console.log("receipt: ", receipt);
      response.success = true;
      response.status = "Unstacked successfully";
    }).catch(function(error){
      console.log("error: ", error);
      response.success = false;
      response.status = "Something went wrong";
    });
    return response;
};

export const batchUnStakeNFT = async (tokens, wallectAddress) => {
    await stakingContract.methods.batchUnstake(tokens)
    .send({
      from: wallectAddress,
      to: stakingContractAddress
    })
    .then(function(receipt){
      console.log("receipt: ", receipt);
      response.success = true;
      response.status = "Unstacked successfully";
    }).catch(function(error){
      console.log("error: ", error);
      response.success = false;
      response.status = "Something went wrong";
    });
    return response;
};


//end staking

export {
    getTokenIdsStaked,
    getTokenStakedBalance
}