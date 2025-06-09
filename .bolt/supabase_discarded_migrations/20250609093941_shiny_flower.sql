/*
  # Setup Custom Email Templates for SEOGENIX

  1. Email Templates
    - Customize confirmation email subject and content
    - Set sender name to SEOGENIX
    - Update email branding

  2. Configuration
    - Configure email templates in auth.config
    - Set custom sender information
*/

-- Update auth configuration for custom email templates
UPDATE auth.config 
SET 
  site_url = 'https://localhost:5173',
  email_confirm_subject = 'Confirm Your SEOGENIX Account',
  email_confirm_template = '
    <h2>Welcome to SEOGENIX!</h2>
    <p>Thank you for signing up for SEOGENIX, the AI-powered SEO platform.</p>
    <p>To complete your account setup, please confirm your email address by clicking the link below:</p>
    <p><a href="{{ .ConfirmationURL }}" style="background-color: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Confirm Your SEOGENIX Account</a></p>
    <p>If you did not create an account with SEOGENIX, you can safely ignore this email.</p>
    <p>Best regards,<br>The SEOGENIX Team</p>
    <hr>
    <p style="font-size: 12px; color: #666;">SEOGENIX - AI-Powered SEO Platform</p>
  ',
  smtp_sender_name = 'SEOGENIX'
WHERE id = 1;

-- If the config table doesn't exist or is empty, insert the configuration
INSERT INTO auth.config (
  site_url,
  email_confirm_subject,
  email_confirm_template,
  smtp_sender_name
) 
SELECT 
  'https://localhost:5173',
  'Confirm Your SEOGENIX Account',
  '
    <h2>Welcome to SEOGENIX!</h2>
    <p>Thank you for signing up for SEOGENIX, the AI-powered SEO platform.</p>
    <p>To complete your account setup, please confirm your email address by clicking the link below:</p>
    <p><a href="{{ .ConfirmationURL }}" style="background-color: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Confirm Your SEOGENIX Account</a></p>
    <p>If you did not create an account with SEOGENIX, you can safely ignore this email.</p>
    <p>Best regards,<br>The SEOGENIX Team</p>
    <hr>
    <p style="font-size: 12px; color: #666;">SEOGENIX - AI-Powered SEO Platform</p>
  ',
  'SEOGENIX'
WHERE NOT EXISTS (SELECT 1 FROM auth.config);