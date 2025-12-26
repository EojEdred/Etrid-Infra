declare module 'tronweb' {
  interface TronWebConfig {
    fullHost?: string;
    fullNode?: string;
    solidityNode?: string;
    eventServer?: string;
    privateKey?: string;
    headers?: Record<string, string>;
  }

  interface Block {
    blockID: string;
    block_header: {
      raw_data: {
        number: number;
        txTrieRoot: string;
        witness_address: string;
        parentHash: string;
        version: number;
        timestamp: number;
      };
      witness_signature: string;
    };
    transactions?: Transaction[];
  }

  interface Transaction {
    ret?: Array<{ contractRet: string }>;
    signature: string[];
    txID: string;
    raw_data: {
      contract: Array<{
        parameter: {
          value: Record<string, any>;
          type_url: string;
        };
        type: string;
      }>;
      ref_block_bytes: string;
      ref_block_hash: string;
      expiration: number;
      data?: string;
      timestamp?: number;
    };
    raw_data_hex: string;
  }

  interface TransactionInfo {
    id: string;
    fee?: number;
    blockNumber: number;
    blockTimeStamp: number;
    contractResult?: string[];
    contract_address?: string;
    resMessage?: string;
    receipt?: {
      energy_fee?: number;
      energy_usage_total?: number;
      net_usage?: number;
      net_fee?: number;
      result?: string;
      energy_usage?: number;
    };
    log?: Array<{
      address: string;
      topics: string[];
      data: string;
    }>;
  }

  interface TronAddress {
    fromHex(hex: string): string;
    toHex(base58: string): string;
    fromPrivateKey(privateKey: string): string;
  }

  interface TronTrx {
    getCurrentBlock(): Promise<Block>;
    getBlock(block: number | string): Promise<Block | null>;
    getTransaction(txId: string): Promise<Transaction | null>;
    getTransactionInfo(txId: string): Promise<TransactionInfo | null>;
    getBalance(address: string): Promise<number>;
    sendTransaction(to: string, amount: number, privateKey: string): Promise<any>;
    sign(transaction: any, privateKey: string): Promise<any>;
    sendRawTransaction(signedTransaction: any): Promise<any>;
  }

  interface TronEvent {
    getEventsByContractAddress(
      address: string,
      options?: {
        eventName?: string;
        blockNumber?: number;
        onlyConfirmed?: boolean;
        limit?: number;
        fingerprint?: string;
      }
    ): Promise<any[]>;
  }

  interface TronContractInstance {
    at(address: string): Promise<any>;
  }

  interface TronContractFactory {
    (): TronContractInstance;
    (abi: any[], address: string): Promise<any>;
  }

  interface TransactionBuilder {
    triggerSmartContract(
      contractAddress: string,
      functionSelector: string,
      options?: {
        feeLimit?: number;
        callValue?: number;
        tokenId?: string;
        tokenValue?: number;
        permission_id?: number;
      },
      parameters?: Array<{ type: string; value: any }>,
      issuerAddress?: string
    ): Promise<{ transaction: any; result: { result: boolean } }>;
    triggerConstantContract(
      contractAddress: string,
      functionSelector: string,
      options?: {
        feeLimit?: number;
        callValue?: number;
      },
      parameters?: Array<{ type: string; value: any }>,
      issuerAddress?: string
    ): Promise<{ constant_result: string[]; result: { result: boolean } }>;
  }

  class TronWeb {
    constructor(config: TronWebConfig);
    address: TronAddress;
    trx: TronTrx;
    event: TronEvent;
    transactionBuilder: TransactionBuilder;
    contract: TronContractFactory;
    setPrivateKey(privateKey: string): void;
    setAddress(address: string): void;
    isAddress(address: string): boolean;
    createAccount(): Promise<{ privateKey: string; address: { base58: string; hex: string } }>;
    toHex(str: string): string;
    toUtf8(hex: string): string;
    fromSun(sun: number): number;
    toSun(trx: number): number;
  }

  export = TronWeb;
}
