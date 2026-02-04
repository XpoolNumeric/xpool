import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zuppuxrammhisswduryw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1cHB1eHJhbW1oaXNzd2R1cnl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMTI1OTYsImV4cCI6MjA4Mzc4ODU5Nn0.kAxIDkN0TGWEiDRgIg-zcnVPDnsni9D2loFsxSzF6Z8'

export const supabase = createClient(supabaseUrl, supabaseKey)