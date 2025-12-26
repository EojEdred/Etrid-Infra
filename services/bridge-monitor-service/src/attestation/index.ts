/**
 * Attestation submission module
 *
 * Entry point for submitting attestations to PBC chains
 */

export { AttestationSubmitter } from './AttestationSubmitter';
export {
  AttesterSignature,
  SubmitAttestationParams,
  AttestationSubmissionResult,
  PbcChainConfig,
  AttestationSubmitterConfig,
  AttestationStatus,
  SubmissionOptions,
  ExtendedSubmissionResult,
  TxStatus,
  BridgeAttestationCall,
} from './types';
