import web3 from './web3';
import abi from './crowdfundingAbi.json';

// Αντικατάστησε με τη δική σου διεύθυνση μετά το deploy
const CONTRACT_ADDRESS = '0xA8DbF39CA6950A3376EE23ea89e9a7Ab50b3079a';

// Δημιουργία JS instance του συμβολαίου
const crowdfundingContract = new web3.eth.Contract(
  abi,
  CONTRACT_ADDRESS
);

export default crowdfundingContract;
