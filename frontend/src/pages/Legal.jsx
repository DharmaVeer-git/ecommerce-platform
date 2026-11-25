
import { useNavigate } from 'react-router-dom';
import './Profile.css';

export default function Legal({ type }) {

  const navigate = useNavigate();
  const isPrivacy = type === 'privacy';

  return (

    <main className="sp-page">

      <div className="sp-container">

        <div className="sp-topbar">

          <div>

            <span className="sp-kicker">
              SHOPEASY POLICIES
            </span>

            <h1>
              {isPrivacy
                ? 'Privacy Policy'
                : 'Terms & Conditions'}
            </h1>

            <p>Draft policy — Version 1.0</p>

          </div>

          <button
            className="sp-secondary"
            onClick={() => navigate('/products')}
          >
            Return to ShopEasy
          </button>

        </div>

        <section
          className="sp-card"
          style={{ lineHeight: 1.9 }}
        >

          {isPrivacy ? (

            <>

              <h2>1. Information We Collect</h2>

              <p>
                ShopEasy collects your name, email address,
                mobile number, saved delivery address and
                shopping account information.
              </p>

              <h2>2. Use of Information</h2>

              <p>
                Your information is used for account
                authentication, profile management and
                shopping-related functionality.
              </p>

              <h2>3. Account Security</h2>

              <p>
                Passwords are stored as password hashes.
                Email OTP verification is used to help
                protect customer accounts.
              </p>

              <h2>4. Service Providers</h2>

              <p>
                ShopEasy uses third-party hosting,
                database and email delivery services
                to operate the platform.
              </p>

              <h2>5. Profile Management</h2>

              <p>
                Customers can view and update their
                personal information and delivery address
                through their account profile.
              </p>

            </>

          ) : (

            <>

              <h2>1. Customer Accounts</h2>

              <p>
                Customers should provide accurate
                registration information and maintain
                the confidentiality of their credentials.
              </p>

              <h2>2. Acceptable Use</h2>

              <p>
                Users must not misuse the platform,
                attempt unauthorized access or interfere
                with its normal operation.
              </p>

              <h2>3. Products and Availability</h2>

              <p>
                Product information, prices and availability
                may change.
              </p>

              <h2>4. Demonstration Payments</h2>

              <p>
                The current ShopEasy checkout is a
                demonstration system. Simulated payments
                do not represent actual financial transactions.
              </p>

              <h2>5. Account Responsibility</h2>

              <p>
                Customers are responsible for maintaining
                accurate account and delivery information.
              </p>

            </>

          )}

          <p className="sp-reminder">
            This is a draft policy for the ShopEasy
            demonstration platform and requires review
            before commercial use.
          </p>

        </section>

      </div>

    </main>

  );
}
