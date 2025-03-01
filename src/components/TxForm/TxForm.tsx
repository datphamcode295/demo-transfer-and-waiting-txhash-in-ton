import { useCallback, useState } from "react";
import ReactJson, { InteractionProps } from "react-json-view";
import "./style.scss";
import {
  SendTransactionRequest,
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";
import {
  Address,
  beginCell,
  Cell,
  loadMessage,
  storeMessage,
  Transaction,
} from "@ton/core";
import { useTonClient } from "../../hooks/useTonClient";
import { TonClient } from "@ton/ton";

// In this example, we are using a predefined smart contract state initialization (`stateInit`)
// to interact with an "EchoContract". This contract is designed to send the value back to the sender,
// serving as a testing tool to prevent users from accidentally spending money.
const defaultTx: SendTransactionRequest = {
  // The transaction is valid for 10 minutes from now, in unix epoch seconds.
  validUntil: Math.floor(Date.now() / 1000) + 600,
  messages: [
    {
      // The receiver's address.
      address: Address.parse("0QDbOQjuNTPFPXQ-FV3RXxeCVf-IU87b3wZneCnLbrfczGGz").toString({bounceable: false, testOnly: true}),
      // Amount to send in nanoTON. For example, 0.005 TON is 5000000 nanoTON.
      amount: "5000000",
      // (optional) State initialization in boc base64 format.
      // stateInit:
      //   "te6cckEBBAEAOgACATQCAQAAART/APSkE/S88sgLAwBI0wHQ0wMBcbCRW+D6QDBwgBDIywVYzxYh+gLLagHPFsmAQPsAlxCarA==",
      // // (optional) Payload in boc base64 format.
      // payload: "te6ccsEBAQEADAAMABQAAAAASGVsbG8hCaTc/g==",
    },

    // Uncomment the following message to send two messages in one transaction.
    /*
    {
      // Note: Funds sent to this address will not be returned back to the sender.
      address: 'UQAuz15H1ZHrZ_psVrAra7HealMIVeFq0wguqlmFno1f3B-m',
      amount: toNano('0.01').toString(),
    }
    */
  ],
};

interface WaitForTransactionOptions {
  address: string;
  hash: string;
  refetchInterval?: number;
  refetchLimit?: number;
}

const waitForTransaction = async (
  options: WaitForTransactionOptions,
  client: TonClient
): Promise<Transaction | null> => {
  const { hash, refetchInterval = 2000, refetchLimit, address } = options;

  return new Promise((resolve) => {
    let refetches = 0;
    const walletAddress = Address.parse(address);
    const interval = setInterval(async () => {
      refetches += 1;

      const transactions = await client.getTransactions(walletAddress, {
				limit: 1,
			});
      if (!transactions || transactions.length === 0) {
        clearInterval(interval);
        resolve(null);
        return;
      }
      const lastTx = transactions[0];

      if (lastTx && lastTx.inMessage) {
					const inMsgHash = lastTx.inMessage.body.hash().toString('hex');
          console.log("InMsgHash", inMsgHash);
          console.log("Hash", hash);
          console.log("LastTx", lastTx.hash().toString("hex"));
        if (inMsgHash === hash) {
          clearInterval(interval);
          resolve(lastTx);
        }
      }
      if (refetchLimit && refetches >= refetchLimit) {
        clearInterval(interval);
        resolve(null);
      }
    }, refetchInterval);
  });
};

export function TxForm() {
  const [tx, setTx] = useState(defaultTx);
  const [finalizedTx, setFinalizedTx] = useState<Transaction | null>(null);
  const [msgHash, setMsgHash] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const { client } = useTonClient();

  const wallet = useTonWallet();

  const [tonConnectUi] = useTonConnectUI();

  const onChange = useCallback((value: InteractionProps) => {
    setTx(value.updated_src as SendTransactionRequest);
  }, []);

  return (
    <div className="send-tx-form">
      <h3>Configure and send transaction</h3>

      <ReactJson
        theme="ocean"
        src={defaultTx}
        onEdit={onChange}
        onAdd={onChange}
        onDelete={onChange}
      />

      {wallet ? (
        <button
          disabled={loading}
          onClick={async () => {
            try {
              const result = await tonConnectUi.sendTransaction(tx);
              setLoading(true);
              const hash = Cell.fromBase64(result.boc)
                .hash()
                .toString("hex");

              console.log("Tx Hash:", hash);

              const message = loadMessage(
                Cell.fromBase64(result.boc).asSlice()
              );
              console.log("Message:", message.body.hash().toString("hex"));
              setMsgHash(message.body.hash().toString("hex"));

              if (client) {
                const txFinalized = await waitForTransaction(
                  {
                    address: tonConnectUi.account?.address ?? "",
                    hash: message.body.hash().toString("hex"),
                  },
                  client
                );
                setFinalizedTx(txFinalized);
              }
            } catch (e) {
              console.error(e);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Loading..." : "Send transaction"}
        </button>
      ) : (
        <button onClick={() => tonConnectUi.openModal()}>
          Connect wallet to send the transaction
        </button>
      )}
      <div>Sending Tx Message Hash: {msgHash}</div>
      <div>Sending Tx Hash: {finalizedTx?.hash().toString("hex")}</div>
    </div>
  );
}
