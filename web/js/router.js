// router.js
// Router logic here
import { closeWS } from "./ws.js"
let activeUnmount = null; // stores cleanup function for current view
let activePath = null;


// added a layout flag that allows us to mark which views have the layout and which dont 
const routes = [
    { path: "/", view: () => import("./views/Home.js"), protected: true, layout: true },
    { path: "/posts", view: () => import("./views/Home.js"), protected: true, layout: true },
    { path: "/chat", view: () => import("./views/Chat.js"), protected: true, layout: true },
    { path: "/thread", view: () => import("./views/Thread.js"), protected: true, layout: true },
    { path: "/create", view: () => import("./views/Create.js"), protected: true, layout: true },

    { path: "/login", view: () => import("./views/Login.js"), layout: false },
    { path: "/register", view: () => import("./views/Register.js"), layout: false },
    { path: "/logout", view: () => import("./views/Login.js"), layout: false },
];


// -------------------- to rener error pages more efficiently----------------------- 


async function renderError(ErrorObj) {
    // hide layout
    unrenderLayout();

    // load error view
    const module = await import("./views/Error.js");
    const view = module.default;

    // render
    const app = document.querySelector("#mainarea");
    app.innerHTML = await view(ErrorObj);
}


// --------------------looking at the path to regex----------------------- and getting params

function pathToRegex(path) {
    return new RegExp("^" + path.replace(/\//g, "\\/").replace(/:\w+/g, "([^\\/]+)") + "$");
}

function getParams(match) {
    const values = match.result.slice(1);
    const keys = Array.from(match.route.path.matchAll(/:(\w+)/g)).map(m => m[1]);
    return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
}

// --------------------look at this later --------------------------------------

// export async function checkAuth() {
// if (localstorage.getItem("isLoggedIn")) return true  

//     const res = await fetch("/api/auth/status", {
//         credentials: "include"
//     });

//     if (!res.ok) return false;

//     const data = await res.json();

//     if (data.authenticated) localStorage.setItem("isLoggedIn", true)

//     return localstorage.getItem("isLoggedIn");
// }

export async function checkAuth() {
    // if (localStorage.getItem("isLoggedIn") === "true") return true

    const res = await fetch("/api/auth/status", {
        credentials: "include"
    });

    if (!res.ok) return false;

    const data = await res.json();

    if (data.authenticated) {
        // localStorage.setItem("isLoggedIn", "true");
        return true;
    }

    return false;
}

async function logout() {
    const res = await fetch("/api/logout", {
        credentials: "include",
        method: "POST",
    });
    if (!res.ok) return false;

    const data = await res.json();

    // Clear auth state
    // localStorage.removeItem("isLoggedIn");
    closeWS();

    return data.message === "Logout successful";
}



export async function navigateTo(url) {
    history.pushState(null, "", url);
    await router();
}

// function getCookie(name) {
//     let nameEQ = name + "=";
//     let decodedCookie = decodeURIComponent(document.cookie);
//     let ca = decodedCookie.split(';');

//     for (let i = 0; i < ca.length; i++) {
//         let c = ca[i];
//         while (c.charAt(0) == ' ') {
//             c = c.substring(1);
//         }
//         if (c.indexOf(nameEQ) == 0) {
//             return c.substring(nameEQ.length, c.length);
//         }
//     }
//     return "";
// }


function renderLayout() {
    renderNavBar();
    renderSideBar();
    renderTrackingList();
}

function unrenderLayout() {
    unrenderNavBar();
    unrenderSideBar();
    unrenderTrackingList();
}


function renderNavBar() {
    let nav = document.getElementById("navbar")
    nav.style.display = "";
}


function renderSideBar() {
    let side = document.getElementById("sidebar")
    side.style.display = "";
}

function unrenderNavBar() {
    let nav = document.getElementById("navbar")
    nav.style.display = "none";
}

function unrenderSideBar() {
    let side = document.getElementById("sidebar")
    side.style.display = "none";
}

function unrenderTrackingList(){
    let list = document.getElementById("aa")
    if (list) list.style.display = "none";
}


function renderTrackingList(){
    let list = document.getElementById("aa")
    if (list) list.style.display = "";
}

export async function router() {
    const isAuth = await checkAuth();
    const potentialMatches = routes.map(route => ({
        route,
        result: location.pathname.match(pathToRegex(route.path))
    }));
    let match = potentialMatches.find(m => m.result !== null);



   if (!match) {
    return renderError({code : 404, message: "Page Not Found"});
}

    if (match.route.protected) {

        if (!isAuth) {
            history.replaceState(null, "", "/login");
            closeWS();
            return router();
        }
    }

    //prevent loged in users from seieng login & register 
    if (match.route.path === "/login" || match.route.path === "/register") {
        if (isAuth) {
            history.replaceState(null, "", "/");
            return router();
        }
    }

    if (match.route.path === "/logout") {
        // just call the api, not handled tho
        const loggedOut = await logout();
        console.log("logged out")
        history.replaceState(null, "", "/login");
        return router();
    }



    if (typeof activeUnmount === "function") {
        try { activeUnmount(); } catch (e) { console.log("unmount error:", e); }
        activeUnmount = null;
    }




    // awaiting the import section
    const viewModule = await match.route.view();
    //some weirdmodule i guess
    const view = viewModule.default;


    //putting the app and calling the function using the params we need

    if (match.route.layout && isAuth) {
        renderLayout();
    } else {
        unrenderLayout();
    }

    //it was app
    const app = document.querySelector("#mainarea")
    let params = {};

    if (match.route.params) {
        params = match.route.params;

        console.log(" params = match.route.params; ", params)
    } else {
        params = getParams(match);
    }

    app.innerHTML = await view(params)

    if (typeof viewModule.mount === "function") {
        const maybeUnmount = viewModule.mount(params);

        // allow mount() to either return an unmount function OR you export unmount directly
        if (typeof maybeUnmount === "function") {
            activeUnmount = maybeUnmount;
        } else if (typeof viewModule.unmount === "function") {
            activeUnmount = viewModule.unmount;
        }
    } else if (typeof viewModule.unmount === "function") {
        // if they only export unmount, still store it (rare)
        activeUnmount = viewModule.unmount;
    }

    activePath = match.route.path;

}

//pathname the location is the currenturl we are going to. and we are checking if it matches
// and once that shit matches, we mark it as match to one of our routes