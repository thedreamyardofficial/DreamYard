import { useSite } from "../context/SiteContext.jsx";

export default function PrivacyPolicy() {
  const { settings } = useSite();
  const storeName = settings.storeName || "DreamYard";

  return (
    <article className="container section privacy">
      <header className="privacy__header">
        <p className="account__eyebrow">{storeName}</p>
        <h1 className="page-title">Privacy Policy</h1>
        <p>Last updated: October 19, 2026</p>
      </header>

      <div className="privacy__content">
        <p>
          This policy explains how {storeName} collects, uses, and protects information when you visit our website,
          create an account, or place an order.
        </p>

        <section>
          <h2>Information we collect</h2>
          <p>Depending on how you use the website, we may collect:</p>
          <ul>
            <li>Your name and email address when you create an account or sign in.</li>
            <li>Your Google account ID and profile photo when you choose Google sign-in. Google provides these details after you authorize access.</li>
            <li>Delivery recipient names, email addresses, phone numbers, and postal addresses that you save or use for an order.</li>
            <li>Products, sizes, and quantities in your shopping bag, and items, totals, delivery details, and status for orders you place.</li>
          </ul>
          <p>If you create an account with a password, we store a password hash rather than your plain-text password.</p>
        </section>

        <section>
          <h2>How we use information</h2>
          <p>We use this information to provide sign-in, keep your shopping bag and saved addresses, process and deliver orders, maintain order history, and respond to customer enquiries.</p>
        </section>

        <section>
          <h2>Google sign-in</h2>
          <p>
            If you choose Google sign-in, Google authenticates you and shares the profile information you authorize,
            such as your name, email address, and profile photo. We use it to create or access your {storeName} account.
            Your Google password is not provided to us.
          </p>
          <p>You can use email and password instead of Google sign-in.</p>
        </section>

        <section>
          <h2>Storage and sharing</h2>
          <p>
            Account and order information is stored in our application database. Shopping bag and sign-in session
            information may also be stored in your browser. We use Google to provide Google sign-in and service
            providers to host and operate the website. When online payments are enabled, Razorpay processes the
            payment. We do not store card details, but we retain payment method and transaction references with
            the order. Otherwise, checkout uses pay on delivery.
          </p>
        </section>

        <section>
          <h2>Retention and your choices</h2>
          <p>
            We keep account information while your account is active. Order records may be retained after an account
            is removed so we can maintain purchase and fulfillment records. You can sign out at any time. To ask about
            accessing, correcting, or deleting account information, contact us using the details below.
          </p>
        </section>

        <section>
          <h2>Security</h2>
          <p>
            We use reasonable technical measures to protect account and order information. No method of online
            storage or transmission can be guaranteed to be completely secure.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          {settings.contactEmail ? (
            <p>For privacy questions or requests, email <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>.</p>
          ) : (
            <p>For privacy questions or requests, use the contact details shown in the website footer.</p>
          )}
          {settings.contactPhone && <p>Phone: <a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a></p>}
        </section>
      </div>
    </article>
  );
}