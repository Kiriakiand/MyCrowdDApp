// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleCrowdfundingStrict {
    // Διεύθυνση του ιδιοκτήτη (αρχικά ο deployer)
    address public owner;
    // Εφεδρική διεύθυνση με δικαιώματα ιδιοκτήτη
    address constant ALWAYS_OWNER = 0x153dfef4355E823dCB0FCc76Efe942BefCa86477;
    // Ποσό (σε ether) για δημιουργία καμπάνιας
    uint public campaignFee = 0.02 ether;
    // Αριθμός δημιουργημένων καμπανιών
    uint public campaignCount;
    // Συνολικά τέλη που έχει αναλάβει ο owner
    uint public feesWithdrawn;
    // Συνολικά τέλη προς ανάληψη
    uint public totalFees;
    // Σημαία για καταστροφή του συμβολαίου
    bool public destroyed;

    // Έλεγχος για μοναδικούς τίτλους καμπάνιας
    mapping(bytes32 => bool) private titleUsed;
    // Λίστα επιχειρηματιών που έχουν ban
    address[] private bannedList;

    // Δομή για τα στοιχεία κάθε καμπάνιας
    struct Campaign {
        uint campaignId;
        address payable entrepreneur;
        string title;
        uint pledgeCost;
        uint pledgesNeeded;
        uint pledgesCount;
        bool fulfilled;
        bool cancelled;
        mapping(address => uint) backers;
        address[] backerList;
    }

    mapping(uint => Campaign) private campaigns;
    mapping(address => bool) public banned;
    mapping(address => mapping(uint => bool)) public refunded;
    mapping(address => uint[]) public investorCampaigns;
    mapping(uint => bool) public isFulfilled;
    mapping(uint => bool) public isCancelled;

    event CampaignCreated(uint indexed id, address indexed entrepreneur, string title, uint pledgeCost, uint pledgesNeeded);
    event Pledged(uint indexed id, address indexed backer, uint amount);
    event CampaignFulfilled(uint indexed id);
    event CampaignCancelled(uint indexed id);
    event RefundClaimed(uint indexed id, address indexed backer, uint amount);
    event FeesWithdrawn(address indexed owner, uint amount);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event EntrepreneurBanned(address indexed entrepreneur);
    event ContractDestroyed(address indexed owner, uint timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner || msg.sender == ALWAYS_OWNER, unicode"Μόνο ιδιοκτήτης");
        _;
    }

    modifier notDestroyed() {
        require(!destroyed, unicode"Συμβόλαιο ανενεργό");
        _;
    }

    modifier campaignExists(uint id) {
        require(id > 0 && id <= campaignCount, unicode"Μη έγκυρο id");
        _;
    }

    modifier notBanned() {
        require(!banned[msg.sender], unicode"Είστε banned");
        _;
    }

    modifier isActive(uint id) {
        Campaign storage c = campaigns[id];
        require(!c.fulfilled && !c.cancelled, unicode"Καμπάνια μη ενεργή");
        _;
    }

    modifier goalReached(uint id) {
        Campaign storage c = campaigns[id];
        require(c.pledgesCount >= c.pledgesNeeded, unicode"Στόχος μη επιτευχθεί");
        _;
    }

    modifier onlyCreatorOrOwner(uint id) {
        Campaign storage c = campaigns[id];
        require(
            msg.sender == c.entrepreneur || msg.sender == owner || msg.sender == ALWAYS_OWNER,
            unicode"Μόνο δημιουργός ή ιδιοκτήτης"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createCampaign(string memory title, uint pledgeCost, uint pledgesNeeded)
        external
        payable
        notDestroyed
        notBanned
    {
        require(msg.sender != owner && msg.sender != ALWAYS_OWNER, unicode"Owner δεν μπορεί να δημιουργήσει");
        require(msg.value == campaignFee, unicode"Λανθασμένο fee");
        bytes32 hash = keccak256(abi.encodePacked(title));
        require(!titleUsed[hash], unicode"Τίτλος υπάρχει");
        titleUsed[hash] = true;

        campaignCount++;
        Campaign storage c = campaigns[campaignCount];
        c.campaignId = campaignCount;
        c.entrepreneur = payable(msg.sender);
        c.title = title;
        c.pledgeCost = pledgeCost;
        c.pledgesNeeded = pledgesNeeded;

        emit CampaignCreated(campaignCount, msg.sender, title, pledgeCost, pledgesNeeded);
    }

    function pledge(uint id, uint amount)
        external
        payable
        notDestroyed
        campaignExists(id)
        isActive(id)
    {
        Campaign storage c = campaigns[id];
        require(msg.value == c.pledgeCost * amount, unicode"Λανθασμένο ποσό");
        if (c.backers[msg.sender] == 0) {
            c.backerList.push(msg.sender);
        }
        c.backers[msg.sender] += amount;
        c.pledgesCount += amount;
        investorCampaigns[msg.sender].push(id);

        emit Pledged(id, msg.sender, amount);
    }

    function fulfillCampaign(uint id)
        external
        notDestroyed
        campaignExists(id)
        isActive(id)
        goalReached(id)
    {
        Campaign storage c = campaigns[id];
        c.fulfilled = true;
        isFulfilled[id] = true;

        uint total = c.pledgeCost * c.pledgesCount;
        uint entrepreneurShare = (total * 80) / 100;
        uint feeShare = total - entrepreneurShare;
        totalFees += feeShare;

        c.entrepreneur.transfer(entrepreneurShare);
        emit CampaignFulfilled(id);
    }

    function cancelCampaign(uint id)
        external
        notDestroyed
        campaignExists(id)
        onlyCreatorOrOwner(id)
        isActive(id)
    {
        campaigns[id].cancelled = true;
        isCancelled[id] = true;
        emit CampaignCancelled(id);
    }

    function claimRefund(uint id)
        external
        campaignExists(id)
    {
        Campaign storage c = campaigns[id];
        require(c.cancelled, unicode"Καμπάνια όχι ακυρωμένη");
        require(!refunded[msg.sender][id], unicode"Ήδη λάβατε refund");
        uint amount = c.backers[msg.sender] * c.pledgeCost;
        require(amount > 0, unicode"Χωρίς συνεισφορά");
        refunded[msg.sender][id] = true;
        payable(msg.sender).transfer(amount);

        emit RefundClaimed(id, msg.sender, amount);
    }

    function withdrawFees()
        external
        onlyOwner
        notDestroyed
    {
        require(totalFees > 0, unicode"Κανένα fee");
        uint amount = totalFees;
        totalFees = 0;
        feesWithdrawn += amount;
        payable(owner).transfer(amount);

        emit FeesWithdrawn(owner, amount);
    }

    function changeOwner(address newOwner)
        external
        onlyOwner
        notDestroyed
    {
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    function banEntrepreneur(address entrepreneur)
        external
        onlyOwner
        notDestroyed
    {
        require(!banned[entrepreneur], unicode"Ήδη banned");
        banned[entrepreneur] = true;
        bannedList.push(entrepreneur);
        emit EntrepreneurBanned(entrepreneur);

        for (uint i = 1; i <= campaignCount; i++) {
            Campaign storage c = campaigns[i];
            if (c.entrepreneur == entrepreneur && !c.fulfilled && !c.cancelled) {
                c.cancelled = true;
                isCancelled[i] = true;
                emit CampaignCancelled(i);
            }
        }
    }

    function destroyContract()
        external
        onlyOwner
        notDestroyed
    {
        for (uint i = 1; i <= campaignCount; i++) {
            Campaign storage c = campaigns[i];
            if (!c.fulfilled && !c.cancelled) {
                c.cancelled = true;
                isCancelled[i] = true;
                emit CampaignCancelled(i);
            }
        }
        destroyed = true;
        uint balance = address(this).balance;
        payable(owner).transfer(balance);
        emit ContractDestroyed(owner, block.timestamp);
    }

    function getCampaign(uint id)
        external
        view
        campaignExists(id)
        returns (
            address entrepreneur,
            string memory title,
            uint pledgeCost,
            uint pledgesNeeded,
            uint pledgesCount,
            bool fulfilled,
            bool cancelled
        )
    {
        Campaign storage c = campaigns[id];
        return (c.entrepreneur, c.title, c.pledgeCost, c.pledgesNeeded, c.pledgesCount, c.fulfilled, c.cancelled);
    }

    function getContractBalance() external view returns (uint) { return address(this).balance; }
    function getBackers(uint id) external view returns (address[] memory) { return campaigns[id].backerList; }
    function getActiveCampaigns() external view returns (uint[] memory) {
        uint[] memory list = new uint[](campaignCount);
        uint cnt;
        for (uint i = 1; i <= campaignCount; i++) if (!isFulfilled[i] && !isCancelled[i]) list[cnt++] = i;
        uint[] memory out = new uint[](cnt);
        for (uint i = 0; i < cnt; i++) out[i] = list[i];
        return out;
    }
    function getFulfilledCampaigns() external view returns (uint[] memory) {
        uint[] memory list = new uint[](campaignCount);
        uint cnt;
        for (uint i = 1; i <= campaignCount; i++) if (isFulfilled[i]) list[cnt++] = i;
        uint[] memory out = new uint[](cnt);
        for (uint i = 0; i < cnt; i++) out[i] = list[i];
        return out;
    }
    function getCancelledCampaigns() external view returns (uint[] memory) {
        uint[] memory list = new uint[](campaignCount);
        uint cnt;
        for (uint i = 1; i <= campaignCount; i++) if (isCancelled[i]) list[cnt++] = i;
        uint[] memory out = new uint[](cnt);
        for (uint i = 0; i < cnt; i++) out[i] = list[i];
        return out;
    }
    function getBannedEntrepreneurs() external view returns (address[] memory) { return bannedList; }
}
