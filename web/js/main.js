import { router, navigateTo } from "./router.js"

// in order to make a single page application we need routing
// the routing is not just interacting with just buttons and direct referehes
// we need to make sure
//     we allow the movement of links normally
//         if you click on home you move /home
//         browser buttons back and forward should work

// and for that we need a router. 
// the router detects any change in the current link 
// and also detects any click on a button og interest


//listens for any change in the url (popstate). used for forward and backward buttons in browser
window.addEventListener("popstate", router);


// checking for any click in the window. this is better than making a click for every single event.
// why? when we change the pages, some buttons will disappear so we will needd to make another event listener once again.
document.addEventListener("click", (e) => {

  //checking for an a href with data-link field
  const link = e.target.closest("a[data-link]")
  if (link) {
    e.preventDefault();
    navigateTo(link.href);

    console.log("LINK REF IS: ", link.href) //debug

    return;
  }

  //checking for a button with daata-action field
  const btn = e.target.closest("[data-action]");
  if (btn) {
    const action = btn.dataset.action;

    //basically we can use this if we still need a button
    // in the beginnign we wont but as we move up and intiate the chats we will definitely will
    console.log("action:", action);
    if (action == "Chat") {
    } else if (action == "Create") {
      navigateTo("/create")
    }
  }
});


//checking for form submissions here
document.addEventListener("submit", async (e) => {
  console.count("SUBMIT COUNT");

  const form = e.target.closest('[data-form]')
  if (!form) return;

  e.preventDefault();

  const formName = form.dataset.form;

  const data = Object.fromEntries(new FormData(form))

  if (formName === "register") {
    try {
      console.log("inside the try block of the register form")

      //fetching from this api which is registered in the main.go and handled by RegisterHandler
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const result = await res.json();

if (!res.ok) {
  alert(result.error);
  return;
}

      navigateTo("/")


    } catch (e) {
      console.error("HERE IS THE ERROR IN THE REGISTER:", e);
    }
  }
  if (formName === "login") {
    try {
      console.log("inside the try block of the login form")

      const res = await fetch("/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify(data)
});

const result = await res.json();

if (!res.ok) {
  alert(result.error);
  return;
}

navigateTo("/");

    } catch (e) {
      console.error("HERE IS THE ERROR IN THE LOGIN:", e);
    }
  }

  console.log("form:", formName, data);
})

router();