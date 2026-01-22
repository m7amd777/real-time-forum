export default function LoginView() {
  return `
      <div class="authcard">

        <div class="authcard-header">
          <p>Login</p>
        </div>

        <form id="login-form" data-form="login" class="auth-form">
          <input class="input" type="text" name="email" placeholder="Email or Username" required />
          <input class="input" type="password" name="password" placeholder="Password" required />

          <button type="submit" class="btn-auth">Login</button>
        </form>

        <p class="auth-footer">
          Don’t have an account? <a href="/register">Register</a>
        </p>

      </div>
    
  `;
}
