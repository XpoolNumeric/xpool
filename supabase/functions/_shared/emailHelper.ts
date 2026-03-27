/**
 * Shared Email Helper — Xpool
 * Sends transactional emails via the Resend API (https://resend.com)
 * 
 * Required Supabase Edge Function Secret:
 *   RESEND_API_KEY — get from https://resend.com/api-keys
 *   FROM_EMAIL     — e.g. "Xpool <noreply@xpool.app>" or "Xpool <onboarding@resend.dev>" for testing
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Xpool <onboarding@resend.dev>';

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}

/**
 * Send a transactional email using Resend API.
 * Returns true on success, false on failure (non-critical — never throws).
 */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
    if (!RESEND_API_KEY) {
        console.warn('[EmailHelper] RESEND_API_KEY is not set. Skipping email send.');
        return false;
    }
    if (!opts.to || !opts.subject || !opts.html) {
        console.warn('[EmailHelper] Missing required email fields. Skipping.');
        return false;
    }

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: [opts.to],
                subject: opts.subject,
                html: opts.html,
            }),
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error('[EmailHelper] Resend API error:', res.status, errBody);
            return false;
        }

        console.log('[EmailHelper] Email sent successfully to:', opts.to);
        return true;
    } catch (err) {
        console.error('[EmailHelper] Exception sending email:', err);
        return false;
    }
}

// ─── Email Templates ─────────────────────────────────────────────────────────

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  padding: 32px 16px;
`;

const cardStyle = `
  background: #ffffff;
  border-radius: 16px;
  padding: 32px;
  max-width: 480px;
  margin: 0 auto;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
`;

const headerStyle = `
  background: linear-gradient(135deg, #6d28d9, #4f46e5);
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 24px;
  text-align: center;
`;

const logoStyle = `color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -1px; margin: 0;`;
const taglineStyle = `color: rgba(255,255,255,0.75); font-size: 13px; margin: 4px 0 0;`;

const rowStyle = `display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0;`;
const labelStyle = `color: #888; font-size: 14px;`;
const valueStyle = `color: #1a1a1a; font-size: 14px; font-weight: 600;`;

const footerStyle = `text-align: center; color: #aaa; font-size: 12px; margin-top: 24px;`;

function baseTemplate(content: string): string {
    return `
    <div style="${baseStyle}">
      <div style="${cardStyle}">
        <div style="${headerStyle}">
          <p style="${logoStyle}">XPOOL</p>
          <p style="${taglineStyle}">Smart Ride Sharing</p>
        </div>
        ${content}
        <p style="${footerStyle}">This is an automated message from Xpool. Please do not reply to this email.</p>
      </div>
    </div>`;
}

/** Email to driver: a new passenger has requested their trip */
export function newBookingRequestEmail(opts: {
    driverName: string;
    passengerName: string;
    from: string;
    to: string;
    date: string;
    time: string;
    seats: number;
}): string {
    return baseTemplate(`
    <h2 style="color:#1a1a1a; margin:0 0 8px;">New Booking Request! 🛎️</h2>
    <p style="color:#555; font-size:15px; margin:0 0 24px;">Hi ${opts.driverName}, a passenger wants to join your trip.</p>
    <div style="background:#f9f7ff; border-radius:12px; padding:20px; margin-bottom:20px;">
      <div style="${rowStyle}"><span style="${labelStyle}">Passenger</span><span style="${valueStyle}">${opts.passengerName}</span></div>
      <div style="${rowStyle}"><span style="${labelStyle}">From</span><span style="${valueStyle}">${opts.from}</span></div>
      <div style="${rowStyle}"><span style="${labelStyle}">To</span><span style="${valueStyle}">${opts.to}</span></div>
      <div style="${rowStyle}"><span style="${labelStyle}">Date</span><span style="${valueStyle}">${opts.date}</span></div>
      <div style="${rowStyle}"><span style="${labelStyle}">Time</span><span style="${valueStyle}">${opts.time}</span></div>
      <div style="padding: 10px 0;"><span style="${labelStyle}">Seats Requested</span>&nbsp;&nbsp;<span style="${valueStyle}">${opts.seats}</span></div>
    </div>
    <p style="color:#555; font-size:14px;">Open the Xpool app to <strong>Accept or Reject</strong> this request.</p>
  `);
}

/** Email to passenger: their booking request has been sent */
export function bookingRequestSentEmail(opts: {
    passengerName: string;
    from: string;
    to: string;
    date: string;
    time: string;
}): string {
    return baseTemplate(`
    <h2 style="color:#1a1a1a; margin:0 0 8px;">Request Sent! ✅</h2>
    <p style="color:#555; font-size:15px; margin:0 0 24px;">Hi ${opts.passengerName}, your ride request is pending driver approval.</p>
    <div style="background:#f9f7ff; border-radius:12px; padding:20px;">
      <div style="${rowStyle}"><span style="${labelStyle}">From</span><span style="${valueStyle}">${opts.from}</span></div>
      <div style="${rowStyle}"><span style="${labelStyle}">To</span><span style="${valueStyle}">${opts.to}</span></div>
      <div style="${rowStyle}"><span style="${labelStyle}">Date</span><span style="${valueStyle}">${opts.date}</span></div>
      <div style="padding: 10px 0;"><span style="${labelStyle}">Time</span>&nbsp;&nbsp;<span style="${valueStyle}">${opts.time}</span></div>
    </div>
    <p style="color:#555; font-size:14px; margin-top:20px;">We'll notify you as soon as the driver responds. Check the <strong>My Bookings</strong> tab in the app.</p>
  `);
}

/** Email to passenger: their booking has been approved */
export function bookingApprovedEmail(opts: {
    passengerName: string;
    driverName: string;
    driverPhone: string;
    vehicleType: string;
    vehicleNumber: string;
    from: string;
    to: string;
    date: string;
    time: string;
    totalPrice: string;
}): string {
    return baseTemplate(`
    <h2 style="color:#1a1a1a; margin:0 0 8px;">Ride Confirmed! 🎉</h2>
    <p style="color:#555; font-size:15px; margin:0 0 24px;">Hi ${opts.passengerName}, your driver has accepted your request. Get ready!</p>
    <div style="background:#f0fdf4; border-radius:12px; padding:20px; margin-bottom:16px;">
      <p style="color:#166534; font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 12px;">Driver Info</p>
      <div style="${rowStyle}"><span style="${labelStyle}">Driver Name</span><span style="${valueStyle}">${opts.driverName}</span></div>
      <div style="${rowStyle}"><span style="${labelStyle}">Mobile</span><span style="${valueStyle}">${opts.driverPhone || 'Available in app'}</span></div>
      <div style="${rowStyle}"><span style="${labelStyle}">Vehicle</span><span style="${valueStyle}">${opts.vehicleType}</span></div>
      <div style="padding: 10px 0;"><span style="${labelStyle}">Vehicle No.</span>&nbsp;&nbsp;<span style="${valueStyle}">${opts.vehicleNumber || 'N/A'}</span></div>
    </div>
    <div style="background:#f9f7ff; border-radius:12px; padding:20px;">
      <p style="color:#5b21b6; font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 12px;">Trip Details</p>
      <div style="${rowStyle}"><span style="${labelStyle}">From</span><span style="${valueStyle}">${opts.from}</span></div>
      <div style="${rowStyle}"><span style="${labelStyle}">To</span><span style="${valueStyle}">${opts.to}</span></div>
      <div style="${rowStyle}"><span style="${labelStyle}">Date</span><span style="${valueStyle}">${opts.date}</span></div>
      <div style="${rowStyle}"><span style="${labelStyle}">Time</span><span style="${valueStyle}">${opts.time}</span></div>
      <div style="padding: 10px 0;"><span style="${labelStyle}">Total</span>&nbsp;&nbsp;<span style="${valueStyle}">₹${opts.totalPrice}</span></div>
    </div>
    <p style="color:#555; font-size:14px; margin-top:20px;">Your <strong>OTP</strong> will be sent to you on the day of the ride. Open the app to view it.</p>
  `);
}

/** Email to passenger: their OTP for the ride */
export function rideOtpEmail(opts: {
    passengerName: string;
    otp: string;
    from: string;
    to: string;
    date: string;
}): string {
    return baseTemplate(`
    <h2 style="color:#1a1a1a; margin:0 0 8px;">Your Ride OTP 🔐</h2>
    <p style="color:#555; font-size:15px; margin:0 0 24px;">Hi ${opts.passengerName}, your trip is today! Share this OTP with your driver to start the ride.</p>
    <div style="background:linear-gradient(135deg,#6d28d9,#4f46e5); border-radius:16px; padding:28px; text-align:center; margin-bottom:20px;">
      <p style="color:rgba(255,255,255,0.75); font-size:14px; margin:0 0 8px; letter-spacing:1px; text-transform:uppercase;">Your OTP Code</p>
      <p style="color:#ffffff; font-size:48px; font-weight:800; letter-spacing:12px; margin:0;">${opts.otp}</p>
      <p style="color:rgba(255,255,255,0.6); font-size:12px; margin:12px 0 0;">Valid for this trip only. Do NOT share unless you are in the vehicle.</p>
    </div>
    <div style="background:#f9f7ff; border-radius:12px; padding:16px;">
      <div style="${rowStyle}"><span style="${labelStyle}">From</span><span style="${valueStyle}">${opts.from}</span></div>
      <div style="${rowStyle}"><span style="${labelStyle}">To</span><span style="${valueStyle}">${opts.to}</span></div>
      <div style="padding: 10px 0;"><span style="${labelStyle}">Date</span>&nbsp;&nbsp;<span style="${valueStyle}">${opts.date}</span></div>
    </div>
  `);
}

/** Email to passenger: their ride has started */
export function rideStartedEmail(opts: {
    passengerName: string;
    driverName: string;
    driverPhone: string;
    from: string;
    to: string;
}): string {
    return baseTemplate(`
    <h2 style="color:#1a1a1a; margin:0 0 8px;">Your Ride Has Started! 🚗</h2>
    <p style="color:#555; font-size:15px; margin:0 0 24px;">Hi ${opts.passengerName}, the driver has started the trip. Open the app to track in real-time.</p>
    <div style="background:#f0fdf4; border-radius:12px; padding:20px; margin-bottom:16px;">
      <div style="${rowStyle}"><span style="${labelStyle}">Driver</span><span style="${valueStyle}">${opts.driverName}</span></div>
      <div style="padding: 10px 0;"><span style="${labelStyle}">Contact</span>&nbsp;&nbsp;<span style="${valueStyle}">${opts.driverPhone || 'Available in app'}</span></div>
    </div>
    <div style="background:#f9f7ff; border-radius:12px; padding:20px;">
      <div style="${rowStyle}"><span style="${labelStyle}">From</span><span style="${valueStyle}">${opts.from}</span></div>
      <div style="padding: 10px 0;"><span style="${labelStyle}">To</span>&nbsp;&nbsp;<span style="${valueStyle}">${opts.to}</span></div>
    </div>
    <p style="color:#555; font-size:14px; margin-top:20px;">Track your driver live in the <strong>Xpool app</strong> → My Bookings → View Details.</p>
  `);
}
