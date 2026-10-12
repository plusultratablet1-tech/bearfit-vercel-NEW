// Offline QR Code Model 2, version 4, error correction level L.
// Encodes short ASCII BearFit guest credentials without third-party QR APIs,
// so private guest tokens are never sent to external image services.
const SIZE=33
const DATA_BYTES=80
const ECC_BYTES=20
function gfMultiply(x:number,y:number):number {
  let z=0
  for(let i=7;i>=0;i--){
    z=(z<<1)^((z>>>7)*0x11d)
    z^=((y>>>i)&1)*x
  }
  return z&255
}
function reedSolomon(data:number[]):number[] {
  let generator=[1]
  let root=1
  for(let i=0;i<ECC_BYTES;i++){
    const next=Array(generator.length+1).fill(0) as number[]
    for(let j=0;j<generator.length;j++){
      next[j]^=generator[j]
      next[j+1]^=gfMultiply(generator[j],root)
    }
    generator=next
    root=gfMultiply(root,2)
  }
  const code=[...data,...Array(ECC_BYTES).fill(0)] as number[]
  for(let i=0;i<data.length;i++){
    const scale=code[i]
    for(let j=0;j<generator.length;j++)code[i+j]^=gfMultiply(generator[j],scale)
  }
  return code.slice(DATA_BYTES)
}
function encodeBytes(text:string):number[] {
  if(!/^[\x20-\x7e]+$/.test(text)||text.length>78)throw new Error("QR content too long or invalid")
  const bits:number[]=[]
  const add=(num:number,len:number)=>{for(let i=len-1;i>=0;i--)bits.push((num>>>i)&1)}
  add(4,4) // byte mode
  add(text.length,8)
  for(const char of text)add(char.charCodeAt(0),8)
  const cap=DATA_BYTES*8
  const end=Math.min(cap-bits.length,4)
  for(let i=0;i<end;i++)bits.push(0)
  while(bits.length%8)bits.push(0)
  const bytes:number[]=[]
  for(let i=0;i<bits.length;i+=8){
    let n=0;for(let j=0;j<8;j++)n=n<<1|bits[i+j]
    bytes.push(n)
  }
  while(bytes.length<DATA_BYTES)bytes.push(bytes.length%2===0?0xec:0x11)
  return bytes
}
export function guestQrMatrix(text:string):boolean[][]{
  const data=encodeBytes(text)
  const ecc=reedSolomon(data)
  const all=[...data,...ecc]
  const matrix:(boolean|null)[][]=Array.from({length:SIZE},()=>Array(SIZE).fill(null))
  const reserved:boolean[][]=Array.from({length:SIZE},()=>Array(SIZE).fill(false))
  function put(x:number,y:number,v:boolean){
    if(x>=0&&x<SIZE&&y>=0&&y<SIZE){matrix[y][x]=v;reserved[y][x]=true}
  }
  function finder(cx:number,cy:number){
    for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
      const d=Math.max(Math.abs(dx),Math.abs(dy))
      put(cx+dx,cy+dy,d!==2&&d!==4)
    }
  }
  finder(3,3);finder(SIZE-4,3);finder(3,SIZE-4)
  for(let i=8;i<SIZE-8;i++){
    put(i,6,i%2===0)
    put(6,i,i%2===0)
  }
  const ax=SIZE-7,ay=SIZE-7
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const d=Math.max(Math.abs(dx),Math.abs(dy))
    put(ax+dx,ay+dy,d!==1)
  }
  // Format information for error correction L and data mask #0
  const formatData=8
  let remainder=formatData<<10
  for(let i=14;i>=10;i--)if((remainder>>>i)&1)remainder^=0x537<<(i-10)
  const formatBits=((formatData<<10)|remainder)^0x5412
  const bit=(i:number)=>((formatBits>>>i)&1)!==0
  for(let i=0;i<=5;i++)put(8,i,bit(i))
  put(8,7,bit(6));put(8,8,bit(7));put(7,8,bit(8))
  for(let i=9;i<15;i++)put(14-i,8,bit(i))
  for(let i=0;i<8;i++)put(SIZE-1-i,8,bit(i))
  for(let i=8;i<15;i++)put(8,SIZE-15+i,bit(i))
  put(8,SIZE-8,true)
  const payload:number[]=[]
  for(const byte of all)for(let i=7;i>=0;i--)payload.push((byte>>>i)&1)
  let k=0
  for(let right=SIZE-1;right>=1;right-=2){
    if(right===6)right=5
    for(let vert=0;vert<SIZE;vert++){
      const y=((right+1)&2)===0?SIZE-1-vert:vert
      for(let j=0;j<2;j++){
        const x=right-j
        if(reserved[y][x])continue
        const value=k<payload.length?payload[k]===1:false
        matrix[y][x]=value!==((x+y)%2===0) // mask 0
        k++
      }
    }
  }
  return matrix.map(row=>row.map(cell=>Boolean(cell)))
}
export const GUEST_QR_PREFIX="BEARFIT-GUEST:"
export function parseGuestCode(raw:string):string|null {
  const value=raw.trim()
  const match=value.match(/^(?:BEARFIT-GUEST:)?([0-9a-f]{32})$/i)
  return match?match[1].toLowerCase():null
}
