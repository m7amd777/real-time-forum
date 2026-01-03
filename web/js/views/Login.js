export default function LoginView() {
  return `
    <div class="auth-container">
      <h2>Login</h2>

      <form id="login-form" data-form="login" class="auth-form">
        <input
          type="text"
          name="email"
          placeholder="Email"
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          required
        />

        <button type="submit">Login</button>
      </form>

      <p class="auth-footer">
        Don’t have an account? <a href="/register">Register</a>
      </p>
    </div>
  `;
}
