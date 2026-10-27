import crypto from "node:crypto";

const PACKS = {
  starter: { coins: 999, amount: 9900 }, creator: { coins: 2699, amount: 24900 },
  pro_creator: { coins: 5499, amount: 49900 }, studio: { coins: 11999, amount: 99900 },
  studio_plus: { coins: 24999, amount: 199900 }
};
const reply = (res, status, body) => res.status(status).json(body);
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return reply(res,405,{error:"Method not allowed"});
  const token = String(req.headers.authorization || "").replace(/^Bearer /,"");
  if (!token) return reply(res,401,{error:"Please sign in before verifying payment."});
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/,"");
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const keyId = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  if (!url || !anon || !service || !keyId || !secret) return reply(res,503,{error:"Payment verification is not configured on the server."});
  try {
    const who = await fetch(url+"/auth/v1/user",{headers:{apikey:anon,Authorization:"Bearer "+token}});
    if (!who.ok) return reply(res,401,{error:"Session expired. Please sign in again."});
    const user = await who.json();
    const {razorpay_order_id:orderId,razorpay_payment_id:paymentId,razorpay_signature:signature}=req.body||{};
    if (![orderId,paymentId,signature].every(v=>typeof v==="string"&&v.length>5)) return reply(res,400,{error:"Payment details are incomplete."});
    const expected=crypto.createHmac("sha256",secret).update(orderId+"|"+paymentId).digest("hex");
    const a=Buffer.from(signature),b=Buffer.from(expected);
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return reply(res,400,{error:"Payment signature verification failed."});
    const base=url+"/rest/v1";
    const headers={apikey:service,Authorization:"Bearer "+service,"Content-Type":"application/json"};
    const lookup=await fetch(base+"/coin_purchases?select=id,user_id,razorpay_order_id,coins,amount_paise,currency,status&razorpay_order_id=eq."+encodeURIComponent(orderId)+"&limit=1",{headers});
    const rows=await lookup.json();
    if(!lookup.ok) throw new Error("Purchase lookup failed");
    const purchase=rows[0];
    if(!purchase||purchase.user_id!==user.id) return reply(res,403,{error:"This payment order does not belong to your account."});
    if(purchase.currency!=="INR") return reply(res,400,{error:"Unsupported payment currency."});
    const paymentResponse=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(paymentId),{headers:{Authorization:"Basic "+Buffer.from(keyId+":"+secret).toString("base64")}});
    const payment=await paymentResponse.json();
    if(!paymentResponse.ok||payment.order_id!==orderId||payment.status!=="captured"||Number(payment.amount)!==Number(purchase.amount_paise)||payment.currency!=="INR") return reply(res,402,{error:"Payment is not captured or amount does not match. Coins have not been added."});
    if(purchase.status==="paid") return reply(res,200,{success:true,duplicate:true,balanceEndpoint:"/api/coins/wallet"});
    const rpc=await fetch(base+"/rpc/credit_coin_purchase",{method:"POST",headers,body:JSON.stringify({p_user_id:user.id,p_coins:Number(purchase.coins),p_order_id:orderId,p_payment_id:paymentId})});
    if(!rpc.ok){console.error("Credit RPC failed",rpc.status,(await rpc.text()).slice(0,200));throw new Error("Wallet credit failed");}
    return reply(res,200,{success:true,coins:Number(purchase.coins),balanceEndpoint:"/api/coins/wallet"});
  } catch(e){console.error("Payment verification failed",e);return reply(res,502,{error:"Payment was received but verification is still processing. Refresh wallet in a moment; do not pay again."});}
}