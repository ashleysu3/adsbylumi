// Shared Lumi brand styles for auth email templates.
// Email body must stay white per email best practices, even though
// the app uses a cream background.

export const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "'Red Hat Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
  margin: '0',
  padding: '0',
}

export const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '0',
  backgroundColor: '#ffffff',
}

export const headerBar = {
  background:
    'linear-gradient(135deg, #F97316 0%, #EC4899 40%, #A78BFA 70%, #93C5FD 100%)',
  padding: '28px 32px',
  borderRadius: '16px 16px 0 0',
  textAlign: 'center' as const,
}

export const wordmark = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 800 as const,
  letterSpacing: '-0.5px',
  margin: '0',
}

export const card = {
  padding: '36px 32px 32px',
  border: '1px solid #F5F3EE',
  borderTop: 'none',
  borderRadius: '0 0 16px 16px',
}

export const h1 = {
  fontSize: '24px',
  fontWeight: 800 as const,
  color: '#111111',
  margin: '0 0 16px',
  letterSpacing: '-0.3px',
  lineHeight: '1.25',
}

export const text = {
  fontSize: '15px',
  color: '#4a5568',
  lineHeight: '1.7',
  margin: '0 0 20px',
}

export const link = { color: '#EC4899', textDecoration: 'underline' }

export const button = {
  background:
    'linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700 as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const codeStyle = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: '28px',
  fontWeight: 700 as const,
  color: '#111111',
  letterSpacing: '6px',
  background: '#FAF9F6',
  border: '1px solid #F5F3EE',
  borderRadius: '12px',
  padding: '16px 20px',
  textAlign: 'center' as const,
  margin: '0 0 24px',
}

export const footer = {
  fontSize: '12px',
  color: '#a0aec0',
  margin: '28px 0 0',
  lineHeight: '1.6',
}

export const footerBar = {
  textAlign: 'center' as const,
  padding: '20px 32px 0',
  fontSize: '11px',
  color: '#a0aec0',
}
