const base=process.env.HEALTHCHECK_URL||'http://127.0.0.1:3000';
for(const route of ['/','/api/health/']){const response=await fetch(base+route,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Health check failed: '+route);}
console.log('Application health check passed.');
