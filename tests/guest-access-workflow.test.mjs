import fs from "node:fs"
import test from "node:test"
import assert from "node:assert/strict"
import {createHash} from "node:crypto"
import ts from "typescript"

const sql=fs.readFileSync("supabase/migrations/20261013080000_guest_access_passes.sql","utf8")
const qrSource=fs.readFileSync("lib/guest-qr.ts","utf8")
const qrComponent=fs.readFileSync("components/bearfit/GuestQRCode.tsx","utf8")
const member=fs.readFileSync("app/member/guests/MemberGuestsClient.tsx","utf8")
const guest=fs.readFileSync("app/guest/register/GuestRegistrationClient.tsx","utf8")
const admin=fs.readFileSync("app/staff/guests/GuestControlClient.tsx","utf8")
const coach=fs.readFileSync("app/coach/CoachHomeClient.tsx","utf8")
const adminPage=fs.readFileSync("app/staff/guests/page.tsx","utf8")
const memberPage=fs.readFileSync("app/member/guests/page.tsx","utf8")
const nav=fs.readFileSync("components/bearfit/StaffAppShell.tsx","utf8")
const dashboard=fs.readFileSync("components/bearfit/BearfitDashboardClient.tsx","utf8")
const code=ts.transpileModule(qrSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const m={exports:{}}
new Function("module","exports",code)(m,m.exports)
const {guestQrMatrix,parseGuestCode,GUEST_QR_PREFIX}=m.exports

test("01 bearer guest credential is 128 random bits and SHA256 hashed at rest",()=>{
 assert.match(sql,/extensions\.gen_random_bytes\(16\)/)
 assert.match(sql,/encode\(extensions\.digest\(v_token,'sha256'\),'hex'\)/)
 assert.match(sql,/token_hash text not null unique/)
 assert.doesNotMatch(sql,/token_plaintext/)
})
test("02 guest invitation only comes from authenticated member with active linked membership",()=>{
 assert.match(sql,/function public\.member_invite_guest/)
 assert.match(sql,/p\.role='member'/)
 assert.match(sql,/membership_status/)
 assert.match(sql,/user_id=\(select auth\.uid\(\)\) for update/)
})
test("03 host may only select assigned branch and upcoming fourteen days",()=>{
 assert.match(sql,/p_branch is distinct from v_member\.branch/)
 assert.match(sql,/p_visit_day>v_today\+14/)
 assert.match(sql,/Maximum three guest invitations per day/)
})
test("04 guest registration never creates Auth user or member row",()=>{
 assert.match(sql,/function public\.guest_register_invitation/)
 assert.doesNotMatch(sql,/insert into public\.(members|profiles|bookings|session_logs|coach_conductions)/)
 assert.doesNotMatch(sql,/auth\.admin\.createUser/)
})
test("05 guest registration requires name, phone and explicit rules acceptance",()=>{
 assert.match(sql,/if not coalesce\(p_accept_rules,false\)/)
 assert.match(sql,/p_guest_phone !~ '\^\[\+0-9/)
 assert.match(guest,/type="checkbox" required/)
})
test("06 only visitor-only access self-activates",()=>{
 assert.match(sql,/when v\.purpose='visitor' then 'active'/)
 assert.match(sql,/in \('gym_day','training'\) then 'pending_payment'/)
 assert.match(sql,/else 'pending_approval'/)
})
test("07 no guest workout or coaching automatically activated by invitation",()=>{
 assert.match(sql,/status text not null default 'invited'/)
 assert.match(guest,/Registration is not permission to work out/)
 assert.match(guest,/visitor-only/i)
})
test("08 paid pass activation needs actual Admin with configured amount/reference",()=>{
 assert.match(sql,/p\.role='admin'/)
 assert.match(sql,/if v_fee is null then raise exception 'Configure the official guest price first'/)
 assert.match(sql,/p_amount<v_fee/)
 assert.match(sql,/p_payment_reference is null/)
 assert.match(sql,/guest_invites_verified_reference_uq/)
 assert.match(admin,/Confirm money actually reached an official BearFit account/)
})
test("09 no assumed gym prices in migration",()=>{
 assert.doesNotMatch(sql,/values\(\s*\x27Malingap Branch\x27\s*,\s*\x27gym_day\x27\s*,\s*[0-9]/)
 assert.match(sql,/admin_set_guest_price/)
})
test("10 free trial and X-deal need a documented Admin authorization",()=>{
 assert.match(sql,/p_action='approve_promotion'/)
 assert.match(sql,/v\.purpose not in \('trial','xdeal'\)/)
 assert.match(sql,/length\(btrim\(coalesce\(p_note,''\)\)\)<12/)
})
test("11 one approved trial per phone, including current active pass",()=>{
 assert.match(sql,/hashtextextended\(lower\(v\.guest_phone\),77\)/)
 assert.match(sql,/status in \('active','redeemed'\)/)
 assert.match(sql,/Guest already received an approved trial/)
})
test("12 guest token is only usable for approved date and branch",()=>{
 assert.match(sql,/v\.visit_day<>\(now\(\) at time zone 'Asia\/Manila'\)::date/)
 assert.match(sql,/now\(\)>v\.expires_at/)
 assert.match(sql,/v_branch<>v\.branch/)
})
test("13 coach must have linked active identity and verified clock-in",()=>{
 assert.match(sql,/where c\.user_id=v_user and c\.is_active/)
 assert.match(sql,/s\.clock_out_at is null/)
 assert.match(sql,/Verified clock-in is required to check guest passes/)
})
test("14 pass redemption is atomic, permanent and audited",()=>{
 assert.match(sql,/where token_hash=encode\(extensions\.digest\(p_token,'sha256'\),'hex'\) for update/)
 assert.match(sql,/if v\.status<>'active'/)
 assert.match(sql,/update public\.guest_invites set status='redeemed'/)
 assert.match(sql,/insert into public\.guest_invite_events/)
})
test("15 no direct guest table INSERT UPDATE DELETE by authenticated or anon",()=>{
 assert.match(sql,/revoke all on public\.guest_invites,public\.guest_access_prices,public\.guest_invite_events from public,anon,authenticated/)
 assert.match(sql,/create policy guest_invites_admin_read/)
 assert.doesNotMatch(sql,/grant (insert|update|delete) on public\.guest_/i)
})
test("16 public guest token endpoints restricted to register and status",()=>{
 assert.match(sql,/grant execute on function public\.guest_register_invitation.*to anon,authenticated/)
 assert.match(sql,/grant execute on function public\.guest_invitation_status.*to anon,authenticated/)
 assert.match(sql,/grant execute on function public\.admin_decide_guest.*to authenticated/)
})
test("17 no package, Bearforce, booking or payable conduction mutations",()=>{
 assert.doesNotMatch(sql,/update public\.(member_package_cycles|members|session_logs|coach_conductions|bookings)/)
 assert.doesNotMatch(sql,/private\.consume_package_session|award_bearforce_points/)
})
test("18 guest pass is separate gym access vs actual coach conduction",()=>{
 assert.match(guest,/does not automatically include coaching/)
 assert.match(sql,/conduction must be recorded separately/)
})
test("19 member invitation shows valid types and private link",()=>{
 for(const value of ["visitor","gym_day","training","trial","xdeal"])assert.match(member,new RegExp('value:"'+value+'"'))
 assert.match(member,/\/guest\/register\?invite=/)
 assert.match(member,/Share \/ copy link/)
})
test("20 public page can register and refresh status without requiring guest signup",()=>{
 assert.match(guest,/guest_register_invitation/)
 assert.match(guest,/guest_invitation_status/)
 assert.match(guest,/GuestQRCode/)
 assert.doesNotMatch(guest,/auth\.signUp/)
})
test("21 coach cannot accept arbitrary guest credentials as a member check-in",()=>{
 assert.match(coach,/coach_check_guest_pass/)
 assert.match(coach,/parseGuestCode/)
 assert.match(coach,/p_redeem:redeem/)
 assert.match(coach,/Admit guest · Use pass once/)
})
test("22 admin fee control and decisions exist behind protected page",()=>{
 assert.match(adminPage,/profile\?\.role!=="admin"/)
 assert.match(admin,/admin_set_guest_price/)
 assert.match(admin,/admin_decide_guest/)
 assert.match(admin,/pending_payment/)
 assert.match(admin,/pending_approval/)
})
test("23 member route protected and accessible through dashboard",()=>{
 assert.match(memberPage,/profile\?\.role!=="member"/)
 assert.match(dashboard,/Bring a Friend \/ Guest Pass/)
 assert.match(dashboard,/\/member\/guests/)
 assert.match(nav,/\/staff\/guests/)
})
test("24 QR is drawn offline using an SVG and no third party URL",()=>{
 assert.match(qrComponent,/guestQrMatrix/)
 assert.match(qrComponent,/<svg/)
 assert.doesNotMatch(qrComponent,/api\.qrserver|chart\.googleapis|unpkg\.com|fetch\(/)
 assert.doesNotMatch(qrSource,/fetch\(|api\.qrserver|chart\.googleapis/)
})
test("25 independently validated QR Model 2 v4-L encodes a known scanner-decodable credential",()=>{
 const secret="0123456789abcdef0123456789abcdef"
 const qr=guestQrMatrix(GUEST_QR_PREFIX+secret)
 assert.equal(qr.length,33)
 assert.ok(qr.every(r=>r.length===33))
 const digest=createHash("sha256").update(qr.flat().map(v=>v?"1":"0").join("")).digest("hex")
 // Known matrix fingerprint independently compared with python-qrcode v4-L, mask 0.
 assert.equal(digest,"206e5d97b668f42ac76058819c2d27d3a7a8c15cc9ffab7b242500b64b99d123")
})
test("26 guest QR parser excludes member codes and malformed credentials",()=>{
 assert.equal(parseGuestCode("BEARFIT-GUEST:0123456789abcdef0123456789abcdef"),"0123456789abcdef0123456789abcdef")
 assert.equal(parseGuestCode("M0001"),null)
 assert.equal(parseGuestCode("BEARFIT-GUEST:000"),null)
})
