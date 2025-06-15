import Web3 from 'web3';

let web3;

if (window.ethereum) {
  // Χρησιμοποιούμε MetaMask provider
  web3 = new Web3(window.ethereum);
  // Ζητάμε άδεια πρόσβασης στον λογαριασμό
  window.ethereum
    .request({ method: 'eth_requestAccounts' })
    .catch(err => console.error('User denied account access', err));
} else {
  alert('Παρακαλώ εγκαταστήστε MetaMask για να χρησιμοποιήσετε αυτήν την DApp');
}

export default web3;
