import type { SessionRecord } from "../limits";

export type AppAttestDeviceRecord = {
  created_at_ms: number;
  hashed_install_id: string;
  key_id: string;
  public_key_pem: string;
  sign_count: number;
  updated_at_ms: number;
};

export type ReportInboxRecord = {
  app_session_id: string;
  created_at_ms: number;
  error_category: string;
  provider_metadata?: Record<string, unknown>;
  report_id: string;
  retained_text_snapshot: boolean;
  revision: number;
  source_language: string;
  span_id: string;
  target_language: string;
};

export type DurableLimitState = {
  app_attest_devices_by_key_id: Record<string, AppAttestDeviceRecord>;
  report_inbox_by_id: Record<string, ReportInboxRecord>;
  report_inbox_order: string[];
  report_timestamps_by_session: Record<string, number[]>;
  session_starts_by_install: Record<string, number[]>;
  sessions_by_id: Record<string, SessionRecord>;
  telemetry_timestamps_by_client: Record<string, number[]>;
};

export type DurableLimitRequest =
  | {
      action: "create_session_record";
      app_session_id: string;
      enforce_limits?: boolean;
      hashed_install_id: string;
      now_ms: number;
    }
  | {
      action: "close_session";
      app_session_id: string;
      now_ms: number;
    }
  | {
      action: "reserve_realtime_session";
      app_session_id: string;
      now_ms: number;
    }
  | {
      action: "can_accept_report";
      app_session_id: string;
      now_ms: number;
    }
  | {
      action: "can_accept_telemetry";
      hashed_client_id: string;
      now_ms: number;
    }
  | {
      action: "store_report";
      report: ReportInboxRecord;
    }
  | {
      action: "list_reports";
      limit: number;
    }
  | {
      action: "delete_report";
      report_id: string;
    }
  | {
      action: "get_session";
      app_session_id: string;
    }
  | {
      action: "get_app_attest_device";
      key_id: string;
    }
  | {
      action: "store_app_attest_device";
      hashed_install_id: string;
      key_id: string;
      now_ms: number;
      public_key_pem: string;
      sign_count: number;
    }
  | {
      action: "update_app_attest_sign_count";
      key_id: string;
      now_ms: number;
      sign_count: number;
    };
