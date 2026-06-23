export {
  SubRosaClient,
  type SubRosaClientConfig,
  type CreateRoundParams,
  type CommitParams,
  type RevealParams,
  type ClearingRuleTag,
} from "./client.js";
export {
  createOzChannelsSubmitter,
  createOzChannelsSubmitterFromEnv,
  type OzChannelsSubmitterConfig,
  type SubmittedTransaction,
  type SubmitSignedTransactionParams,
  type TransactionSubmitter,
} from "./submitter.js";
export {
  SubRosaClientConfigError,
  SubRosaMissingReturnValueError,
  SubRosaSubmitError,
  SubRosaTimeoutError,
  SubRosaTransactionError,
} from "./errors.js";
export type { TimeoutErrorParams } from "./errors.js";
export { MAINNET_ARTIFACTS, MAINNET_MICRO_MAX_ESCROW } from "./mainnet-artifacts.js";

export {
  serializeReceipt,
  parseReceipt,
  networkFingerprint,
  type RoundReceipt,
  type BidReceiptEntry,
  RECEIPT_VERSION,
} from "./receipt.js";
export {
  verifyReceipt,
  type VerificationIssue,
  type VerificationResult,
  type VerifyOptions,
  type Severity,
} from "./verify.js";

// Re-export the generated contract types so consumers get spec-accurate shapes
// from a single import surface.
export {
  Client as RoundContract,
  Errors as RoundErrors,
  type Round,
  type BidState,
  type BiddersPage,
  type Seal,
  type GlobalConfig,
  type ClearingRule,
  type Status,
  type DataKey,
} from "@sub-rosa/round-bindings";
