import{api,saveSession,clearSession}from'./client.js';
export async function signIn(email,password){const payload=await api('/api/auth/signin',{method:'POST',body:{email,password}});saveSession(payload);return payload}
export async function signUp(display_name,email,password){const payload=await api('/api/auth/signup',{method:'POST',body:{display_name,email,password}});if(payload.access_token)saveSession(payload);return payload}
export async function signOut(){try{await api('/api/auth/signout',{method:'POST'})}finally{clearSession()}}
export const resetPassword=email=>api('/api/auth/password-reset',{method:'POST',body:{email,redirect_to:location.origin}});
