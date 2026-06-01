import dns from 'dns';
dns.resolve('eknbbuxiabijnaohzrph.supabase.co', (err, addresses) => {
  console.log('Error:', err);
  console.log('Addresses:', addresses);
});
