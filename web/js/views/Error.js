export default function ErrorView(ErrorObj) {
  return `
    <div class="auth-page">
      <div class="authcard error-card">

        <div class="error-body">
          <div class="error-code">${ErrorObj.code}</div>
          <div class="error-message">${ErrorObj.message}</div>

          <a href="/" class="btn-auth error-btn">
            Go Home
          </a>
        </div>

      </div>
    </div>
  `;
}
