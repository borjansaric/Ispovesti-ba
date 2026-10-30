export const protectedProjects=new Set(['roxajqagksffbsbzdrap','wrvljpngjsinidbcpyaq']);
export function assertIsolatedProject(url,ref){
 if(typeof ref!=='string'||!/^[a-z]{20}$/.test(ref)||protectedProjects.has(ref)||new URL(url).href!==`https://${ref}.supabase.co/`)throw Error('Potreban je novi, tačno određeni Supabase projekat.');
 return ref;
}
export function sandboxConfig(value){
 const c={...value};
 if(c.mode!=='recovery-sandbox'||typeof c.projectRef!=='string'||!/^[a-z]{20}$/.test(c.projectRef)||protectedProjects.has(c.projectRef))throw Error('Potreban je novi, odvojeni Supabase projekat.');
 assertIsolatedProject(c.supabaseUrl,c.projectRef);
 const site=new URL(c.siteOrigin);if(site.protocol!=='https:'||site.username||site.password||site.port||site.pathname!=='/'||site.search||site.hash||site.hostname==='borjansaric.github.io'||site.hostname==='ispovesti.ba'||site.hostname.endsWith('.ispovesti.ba'))throw Error('Potreban je odvojeni HTTPS sajt.');
 if(typeof c.publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(c.publishableKey))throw Error('Dozvoljen je samo javni ključ probnog projekta.');
 return Object.freeze(c);
}
