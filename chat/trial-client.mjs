// Local/test review only; never imported by the main chat client.
export const trialCode=()=>'TEST-'+Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase().match(/.{6}/g).join('-');
