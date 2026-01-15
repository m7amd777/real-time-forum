export default function RegisterView() {
  return `
    <div class="auth-page">
      <div class="authcard">

        <div class="authcard-header">
          <p>Register</p>
        </div>

        <form id="register-form" data-form="register" class="auth-form">
          <input
            class="input"
            type="text"
            name="firstname"
            placeholder="First Name"
            required
          />

          <input
            class="input"
            type="text"
            name="lastname"
            placeholder="Last Name"
            required
          />

          <input
            class="input"
            type="number"
            name="age"
            placeholder="Age"
            min="1"
            required
          />

          <select class="input" name="gender" required>
            <option value="" disabled selected>Gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>

          <input
            class="input"
            type="email"
            name="email"
            placeholder="Email"
            required
          />

          <input
            class="input"
            type="text"
            name="username"
            placeholder="Username"
            required
          />

          <input
            class="input"
            type="password"
            name="password"
            placeholder="Password"
            required
          />

          <button type="submit" class="btn-auth">
            Register
          </button>
        </form>

        <p class="auth-footer">
          Already have an account?
          <a href="/login">Login</a>
        </p>

      </div>
    </div>
  `;
}
