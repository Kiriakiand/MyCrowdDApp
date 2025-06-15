// src/App.js
import React, { useState, useEffect } from 'react'
import web3 from './web3'
import contract from './contract'

function App() {
  // ======= 1. Σύνδεση Active Account =======
  const [account, setAccount] = useState(null)

  // ======= 1. Header data =======
  const [owner, setOwner]       = useState('')
  const [balance, setBalance]   = useState('0')
  const [collected, setCollected] = useState('0')

  // ======= Λίστες καμπανιών =======
  const [liveCampaigns,     setLiveCampaigns]     = useState([])
  const [fulfilledCampaigns, setFulfilledCampaigns] = useState([])
  const [cancelledCampaigns, setCancelledCampaigns] = useState([])

  // ======= Φόρμα New Campaign =======
  const [newTitle,  setNewTitle]  = useState('')
  const [newCost,   setNewCost]   = useState('')
  const [newTarget, setNewTarget] = useState('')

  // ======= Control Panel inputs =======
  const [newOwner, setNewOwner] = useState('')
  const [banAddr,  setBanAddr]  = useState('')

  // όταν φορτώνει η σελίδα, ζητάμε ένα account
  useEffect(() => {
    async function loadAccount() {
      const accs = await web3.eth.getAccounts()
      if (accs.length > 0) setAccount(accs[0])
    }
    loadAccount()
  }, [])

  // Φορτώνουμε όλα τα δεδομένα και ακούμε events για real‑time updates
  useEffect(() => {
    if (!account) return

    // συνάρτηση για φόρτωμα owner, balances, λίστες
    async function loadAll() {
      // 1. owner, balance, collected fees
      const o = await contract.methods.owner().call()
      setOwner(o)

      const b = await contract.methods.getContractBalance().call()
      setBalance(web3.utils.fromWei(b, 'ether'))

      const f = await contract.methods.totalFees().call()
      setCollected(web3.utils.fromWei(f, 'ether'))

      // 2. λίστες καμπανιών
      const [liveIds, doneIds, cancIds] = await Promise.all([
        contract.methods.getActiveCampaigns().call(),
        contract.methods.getFulfilledCampaigns().call(),
        contract.methods.getCancelledCampaigns().call()
      ])

      // helper για λεπτομέρειες κάθε id
      const loadList = async ids => {
        return Promise.all(
          ids.map(async id => {
            const d = await contract.methods.getCampaign(id).call()
            return {
              id,
              entrepreneur: d[0],
              title:        d[1],
              cost:         web3.utils.fromWei(d[2], 'ether'),
              needed:       d[3],
              pledged:      d[4]
            }
          })
        )
      }

      setLiveCampaigns(await loadList(liveIds))
      setFulfilledCampaigns(await loadList(doneIds))
      setCancelledCampaigns(await loadList(cancIds))
    }

    loadAll()

    // subscribe σε ΟΛΑ τα συμβάντα του συμβολαίου
    const sub = contract.events
      .allEvents()
      .on('data', loadAll)

    return () => sub.unsubscribe()
  }, [account])

  // ======= Χειρισμοί κουμπιών =======
  const handleConnect = async () => {
    await window.ethereum.request({ method: 'eth_requestAccounts' })
    const accs = await web3.eth.getAccounts()
    setAccount(accs[0])
  }

  const handleCreate = async () => {
    if (!newTitle || !newCost || !newTarget) {
      alert('Συμπλήρωσε όλα τα πεδία!')
      return
    }
    // δημιουργία καμπάνιας με fee 0.02 ETH
    await contract.methods
      .createCampaign(newTitle, web3.utils.toWei(newCost, 'ether'), newTarget)
      .send({ from: account, value: web3.utils.toWei('0.02', 'ether') })
    setNewTitle('')
    setNewCost('')
    setNewTarget('')
  }

  const handlePledge = async id => {
    const amt = prompt('Πόσες μονάδες pledge;')
    if (!amt) return
    const camp = liveCampaigns.find(c => c.id === id)
    const totalEth = (parseFloat(camp.cost) * parseInt(amt)).toString()
    await contract.methods.pledge(id, amt)
      .send({ from: account, value: web3.utils.toWei(totalEth, 'ether') })
  }

  const handleCancel = async id => {
    await contract.methods.cancelCampaign(id).send({ from: account })
  }

  const handleFulfill = async id => {
    await contract.methods.fulfillCampaign(id).send({ from: account })
  }

  const handleClaimRefund = async id => {
    await contract.methods.claimRefund(id).send({ from: account })
  }

  const handleWithdraw = async () => {
    await contract.methods.withdrawFees().send({ from: account })
  }

  const handleChangeOwner = async () => {
    if (!newOwner) return
    await contract.methods.changeOwner(newOwner).send({ from: account })
    setNewOwner('')
  }

  const handleBan = async () => {
    if (!banAddr) return
    await contract.methods.banEntrepreneur(banAddr).send({ from: account })
    setBanAddr('')
  }

  const handleDestroy = async () => {
    await contract.methods.destroyContract().send({ from: account })
  }

  // ======= Render =======
  return (
    <div style={{ padding: 20 }}>
      {/* σύνδεση metamask */}
      {!account
        ? <button onClick={handleConnect}>Connect Wallet</button>
        : <p>Connected: {account}</p>
      }

      {/* τμήμα 1: header με στοιχεία */}
      <div style={{ borderBottom: '1px solid #ccc', paddingBottom: 10, marginBottom: 20 }}>
        <p>Current Address: {account}</p>
        <p>Owner’s Address: {owner}</p>
        <p>Contract Balance: {balance} ETH</p>
        <p>Collected Fees: {collected} ETH</p>
      </div>

      {/* τμήμα 2: New campaign */}
      <div style={{ marginBottom: 20 }}>
        <h3>New campaign</h3>
        <input
          type="text"
          placeholder="Title"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
        />
        <input
          type="text"
          placeholder="Pledge cost (ETH)"
          value={newCost}
          onChange={e => setNewCost(e.target.value)}
          style={{ marginLeft: 10 }}
        />
        <input
          type="number"
          placeholder="Number of pledges"
          value={newTarget}
          onChange={e => setNewTarget(e.target.value)}
          style={{ marginLeft: 10, width: 80 }}
        />
        <button
          onClick={handleCreate}
          disabled={account === owner} /* ο owner δεν μπορεί να δημιουργήσει */
          style={{ marginLeft: 10 }}
        >
          Create
        </button>
      </div>

      {/* τμήμα 3: Live campaigns */}
      <h3>Live campaigns</h3>
      {liveCampaigns.length === 0 && <p>No live campaigns</p>}
      {liveCampaigns.map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', margin: '5px 0' }}>
          <span style={{ width: 200 }}>{c.entrepreneur}</span>
          <span style={{ width: 120 }}>{c.title}</span>
          <span style={{ width: 80 }}>{c.cost} ETH</span>
          <span style={{ width: 100 }}>{c.pledged} / {c.needed}</span>
          <button onClick={() => handlePledge(c.id)}>Pledge</button>
          {(account === c.entrepreneur || account === owner) && (
            <>
              <button onClick={() => handleCancel(c.id)} style={{ marginLeft: 5 }}>
                Cancel
              </button>
              {(c.pledged >= c.needed) && (
                <button onClick={() => handleFulfill(c.id)} style={{ marginLeft: 5 }}>
                  Fulfill
                </button>
              )}
            </>
          )}
        </div>
      ))}

      {/* τμήμα 4: Fulfilled campaigns */}
      <h3>Fulfilled campaigns</h3>
      {fulfilledCampaigns.length === 0 && <p>No fulfilled campaigns</p>}
      {fulfilledCampaigns.map(c => (
        <div key={c.id}>
          {c.entrepreneur} – {c.title} – {c.cost} ETH – {c.pledged}/{c.needed}
        </div>
      ))}

      {/* τμήμα 5: Cancelled campaigns */}
      <h3>Cancelled campaigns</h3>
      {cancelledCampaigns.length === 0 && <p>No cancelled campaigns</p>}
      {cancelledCampaigns.map(c => (
        <div key={c.id}>
          {c.entrepreneur} – {c.title}
          <button onClick={() => handleClaimRefund(c.id)} style={{ marginLeft: 10 }}>
            Claim
          </button>
        </div>
      ))}

      {/* τμήμα 6: Control Panel */}
      <div style={{ marginTop: 30, borderTop: '1px solid #ccc', paddingTop: 10 }}>
        <h3>Control Panel</h3>
        <button onClick={handleWithdraw} disabled={account !== owner}>
          Withdraw
        </button>

        <div style={{ marginTop: 10 }}>
          <input
            type="text"
            placeholder="New owner address"
            value={newOwner}
            onChange={e => setNewOwner(e.target.value)}
          />
          <button
            onClick={handleChangeOwner}
            disabled={account !== owner}
            style={{ marginLeft: 5 }}
          >
            Change owner
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <input
            type="text"
            placeholder="Entrepreneur to ban"
            value={banAddr}
            onChange={e => setBanAddr(e.target.value)}
          />
          <button
            onClick={handleBan}
            disabled={account !== owner}
            style={{ marginLeft: 5 }}
          >
            Ban entrepreneur
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <button
            onClick={handleDestroy}
            disabled={account !== owner}
          >
            Destroy contract
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
