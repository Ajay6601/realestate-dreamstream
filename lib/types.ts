export interface Property {
  id: string; // UUID - NOT NULL DEFAULT gen_random_uuid()
  property_address: string | null;
  zip_code: string | null;
  city: string | null;
  county: string | null;
  state: string | null;
  decision_maker_name: string | null;
  decision_maker_email: string | null;
  decision_maker_phone: string | null;
  suspend_until: string; // date - NOT NULL DEFAULT CURRENT_DATE
  created_at: string; // timestamp with time zone - NOT NULL DEFAULT timezone('UTC'::text, now())
  updated_at: string; // timestamp with time zone - NOT NULL DEFAULT timezone('UTC'::text, now())
  opt_out_code: string; // UUID - NOT NULL DEFAULT gen_random_uuid() UNIQUE
  hoa_or_management_company: string | null;
}

export interface ExtractedProperty {
  id: string;
  name: string;
  editable: boolean;
}

export interface EmailTemplate {
  id: number; // integer - NOT NULL DEFAULT nextval('email_templates_id_seq'::regclass)
  template_name: string; // text - NOT NULL
  subject: string | null; // text
  hook: string | null; // text
  body: string; // text - NOT NULL
  signature: string | null; // text
  is_active: boolean; // boolean - NOT NULL DEFAULT true
  created_at: string; // timestamp with time zone - NOT NULL DEFAULT timezone('UTC'::text, now())
  updated_at: string; // timestamp with time zone - NOT NULL DEFAULT timezone('UTC'::text, now())
}

export interface EmailLog {
  id: string; // UUID - NOT NULL DEFAULT gen_random_uuid()
  property_id: string; // UUID - NOT NULL
  template_id: number; // integer - NOT NULL
  campaign_day: number; // integer - NOT NULL DEFAULT 1
  replied: boolean; // boolean - NOT NULL DEFAULT false
  email_id: string; // text - NOT NULL
  thread_id: string; // text - NOT NULL UNIQUE
  sent_at: string; // timestamp with time zone - NOT NULL DEFAULT timezone('UTC'::text, now())
  replied_at: string | null; // timestamp with time zone - NULL
  // Joined data from relations (using Supabase naming)
  properties?: Property;
  email_templates?: EmailTemplate;
}

export interface CampaignProgress {
  id: number; // integer - NOT NULL DEFAULT nextval('campaign_progress_id_seq'::regclass)
  current_day: number; // integer - NOT NULL DEFAULT 1
  last_sent_at: string; // timestamp with time zone - NOT NULL DEFAULT timezone('UTC'::text, now())
  pdf_url: string; // text - NOT NULL DEFAULT 'https://...'
}

export interface DashboardStats {
  totalProperties: number;
  totalEmailsSent: number;
  totalReplies: number;
  replyRate: number;
  currentWeek: number;
  activeTemplates: number;
}

export interface PDFProposal {
  name: string;
  size: number;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  publicUrl?: string; // Public URL for the PDF file
  metadata: {
    eTag: string;
    mimetype: string;
    cacheControl: string;
    lastModified: string;
    contentLength: number;
    httpStatusCode: number;
  } | null;
}
