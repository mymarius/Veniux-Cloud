// Classification concerns recorded outbound units, not revenue or a sales forecast.
function classify(rows) {
  const sorted=rows.map(row=>({...row,total_outbound_qty:Math.max(0,Number(row.total_outbound_qty)||0)})).sort((a,b)=>b.total_outbound_qty-a.total_outbound_qty||Number(a.product_id)-Number(b.product_id));
  const total=sorted.reduce((sum,row)=>sum+row.total_outbound_qty,0);
  let cumulative=0;
  return sorted.map(row=>{
    const before=total?cumulative/total:0;
    const abc_class=row.total_outbound_qty===0?'D':before<0.7?'A':before<0.9?'B':'C';
    cumulative+=row.total_outbound_qty;
    return {...row,abc_class,volume_share_pct:total?Number((100*row.total_outbound_qty/total).toFixed(1)):0};
  });
}
module.exports={classify};
