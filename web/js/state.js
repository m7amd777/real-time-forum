
let state = {
    authStatus : "unknown" 
}

export function setState(partial) {
    Object.assign(state, partial)
}

export function getState() {
    return state   
}
