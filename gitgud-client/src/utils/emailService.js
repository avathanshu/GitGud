import emailjs from '@emailjs/browser';

export const sendDynamicEmail = (recipientEmail, recipientName, subject, body, relativePath) => {
  const currentHost = window.location.origin;

  const templateParams = {
    to_email: recipientEmail,
    recipient_name: recipientName,
    email_subject: subject,
    email_body: body,
    action_url: `${currentHost}${relativePath}` 
  };

  emailjs.send(
    import.meta.env.VITE_EMAILJS_SERVICE_ID,
    import.meta.env.VITE_EMAILJS_TEMPLATE_ID, 
    templateParams,
    import.meta.env.VITE_EMAILJS_PUBLIC_KEY
  )
  .then(() => console.log(`"${subject}" email sent successfully!`))
  .catch(err => console.error('Email failed to send:', err));
};