import { useState, useEffect } from "react";

export default function FlowrateWalletAndData() {
  const [wallet, setWallet] = useState(null);
  const [address, setAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [fundingRates, setFundingRates] = useState([]);
  const [signedOrder, setSignedOrder] = useState(null);

  // Detect wallet
  const detectWallet = () => {
    if (window.starknet_argentX) return window.starknet_argentX;
    if (window.starknet_braavos) return window.starknet_braavos;
    return null;
  };

  // Connect wallet
  const connectWallet = async () => {
    const detectedWallet = detectWallet();
    if (!detectedWallet) {
      alert("Please install Argent X or Braavos wallet!");
      return;
    }

    try {
      await detectedWallet.enable();
      setWallet(detectedWallet);
      setAddress(detectedWallet.selectedAddress);
      const bal = await detectedWallet.account.getBalance();
      setBalance(Number(bal) / 1e18);
      localStorage.setItem("walletConnected", "true");
    } catch (err) {
      console.error("Wallet connection failed:", err);
      alert("Failed to connect wallet");
    }
  };

  // Auto reconnect
  useEffect(() => {
    const previouslyConnected = localStorage.getItem("walletConnected");
    if (previouslyConnected) {
      const detectedWallet = detectWallet();
      if (detectedWallet) {
        detectedWallet.enable().then(() => {
          setWallet(detectedWallet);
          setAddress(detectedWallet.selectedAddress);
          detectedWallet.account.getBalance().then((bal) =>
            setBalance(Number(bal) / 1e18)
          );
        });
      }
    }
  }, []);

  // Fetch live funding rates
  const fetchFundingRates = async () => {
    try {
      const response = await fetch(
        "https://api.starknet.sepolia.extended.exchange/api/v1/funding-rates?markets=ETH-USD,BTC-USD"
      );
      const data = await response.json();
      setFundingRates(data);
    } catch (err) {
      console.error("Failed to fetch funding rates:", err);
    }
  };

  useEffect(() => {
    fetchFundingRates();
    const interval = setInterval(fetchFundingRates, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Sign test SNIP-12 order
  const signTestOrder = async () => {
    if (!wallet) {
      alert("Connect wallet first!");
      return;
    }

    try {
      const typedData = {
        domain: {
          name: "Perpetuals",
          version: "v0",
          chainId: "SN_SEPOLIA",
        },
        types: {
          Order: [
            { name: "market", type: "felt" },
            { name: "side", type: "felt" },
            { name: "size", type: "felt" },
            { name: "price", type: "felt" },
            { name: "expiration", type: "felt" },
          ],
        },
        primaryType: "Order",
        message: {
          market: "ETH-USD",
          side: "LONG",
          size: "1",
          price: "0",
          expiration: `${Math.floor(Date.now() / 1000) + 3600}`, // 1 hour from now
        },
      };

      const signature = await wallet.account.signMessage(typedData);
      console.log("Signed order:", signature);
      setSignedOrder(signature);
      alert("Test order signed! Check console for signature.");
    } catch (err) {
      console.error("Signing failed:", err);
      alert("Failed to sign order");
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <header style={{ marginBottom: "1rem" }}>
        {address ? (
          <>
            <div>Wallet: {address}</div>
            <div>ETH Balance: {balance?.toFixed(4)}</div>
          </>
        ) : (
          <button onClick={connectWallet}>Connect Wallet</button>
        )}
      </header>

      <section style={{ marginBottom: "1rem" }}>
        <h2>Funding Rates</h2>
        {fundingRates.length ? (
          <ul>
            {fundingRates.map((m) => (
              <li key={m.market}>
                {m.market}: {m.currentRate}% | Index Price: {m.indexPrice}
              </li>
            ))}
          </ul>
        ) : (
          <p>Loading funding rates...</p>
        )}
      </section>

      <section>
        <button onClick={signTestOrder}>Sign Test Order</button>
        {signedOrder && <p>Order signed! See console for details.</p>}
      </section>
    </div>
  );
}
