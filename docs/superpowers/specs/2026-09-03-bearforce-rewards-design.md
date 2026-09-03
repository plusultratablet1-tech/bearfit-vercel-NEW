# Bearforce Rewards Catalog Design

## Goal
Add a real Bearforce Rewards Catalog where members can browse rewards and request redemption using their current-season spendable Bearforce balance, while staff/admin controls approval, stock, and fulfillment.

## Approved Flow
1. Staff/admin creates or edits a reward with title, description, category, point cost, image URL, active flag, optional stock quantity, and optional active-membership requirement.
2. Member browses active rewards and sees current seasonal spendable balance plus points reserved by pending requests.
3. Member requests a reward. The request immediately reserves the required points and, when stock is limited, one unit of stock. No Bearforce points are spent yet.
4. Staff/admin reviews pending requests.
5. Approve: convert the request into a completed Bearforce redemption, deducting the seasonal spendable balance while lifetime points and season-earned points remain unchanged. Reserved stock becomes consumed.
6. Reject or member-cancel before approval: release the reserved points and reserved stock. No Bearforce points are spent.
7. Staff marks an approved reward as fulfilled/claimed after handoff or completion.
8. Member can see Pending, Approved, Claimed, Rejected, and Cancelled history. Staff can see the full request log.

## Data Model
### `reward_catalog`
- `id uuid primary key`
- `title text`
- `description text`
- `category text`
- `image_url text nullable`
- `points_cost integer > 0`
- `stock_quantity integer nullable` where null means unlimited stock
- `reserved_quantity integer default 0`
- `redeemed_quantity integer default 0`
- `requires_active_membership boolean default true`
- `active boolean default true`
- `created_by uuid`
- timestamps

Available stock is `stock_quantity - reserved_quantity - redeemed_quantity` when stock is limited.

### `reward_requests`
- `id uuid primary key`
- `member_id uuid`
- `reward_id uuid`
- `season_key text`
- `points_cost integer` snapshot at request time
- `status text`: `pending`, `approved`, `rejected`, `cancelled`, `claimed`
- `bearforce_redemption_id uuid nullable`
- request, decision, claim timestamps
- `requested_by`, `decided_by`, `claimed_by`
- `decision_note text nullable`

A member may have only one pending request per reward at a time.

## Reservation Rules
Pending requests reserve seasonal points without spending them. The member's available-to-request balance is:

`season_balance - sum(points_cost of pending reward requests in the current season)`

For limited stock, a pending request increments `reserved_quantity`. Approval decrements `reserved_quantity` and increments `redeemed_quantity`. Rejection/cancellation decrements `reserved_quantity` only.

Request creation uses row locks on the member and reward so balance and stock checks are atomic.

## Approval and Spending
Approval calls the existing Bearforce spend engine by creating a completed `bearforce_redemptions` row for the request's point cost and current request season. Approval is allowed only while the request is pending and still belongs to the current season. This prevents a prior-season pending request from spending a new season balance.

Lifetime Bearforce Points and Season Earned never decrease. Only current-season spendable balance decreases after approval.

## Season Expiry
Pending requests from an ended season cannot be approved. Staff may reject them, and a member may cancel them, which releases reservations. No automatic expiry worker is required in this milestone.

## Membership Rule
Rewards with `requires_active_membership = true` can only be requested when the member's membership is active. Staff may create rewards that do not require active membership.

## Permissions
- Members can read active catalog items and their own requests.
- Members can request and cancel their own pending requests only through controlled RPCs.
- Staff/admin can read all catalog and request records and create/update rewards.
- Staff/admin can approve/reject/claim requests through controlled RPCs.
- Direct authenticated writes to catalog, requests, and Bearforce redemption tables are revoked.

## UI
### Member `/member/rewards`
- Bearforce header: season, spendable balance, reserved points, available-to-request points.
- Responsive reward cards with image, category, point cost, stock state, membership requirement, affordability state, and Redeem button.
- History section with status chips and timestamps.
- Member can cancel only pending requests.

### Staff `/staff/rewards`
- Staff/admin protected page.
- Create reward form.
- Catalog manager for active/inactive, point cost, stock, category, image URL, membership rule.
- Pending request queue with Approve and Reject.
- Approved requests can be marked Claimed.
- Full recent request history.
- Header links to Schedule, Payments, and Check-in.

## Navigation
- Add Rewards to member desktop sidebar and mobile bottom navigation without removing existing core destinations.
- Add Rewards link to the staff schedule workspace header.

## Error Handling
All balance, stock, membership, status-transition, and season checks occur server-side in PostgreSQL RPCs. UI errors surface the returned database message and reload state after a successful action.

## Testing
Regression tests cover schema/RLS, reservation math, limited and unlimited stock, affordability, active-membership requirement, double-request prevention, member cancellation, approval point spend, rejection release, claim flow, prior-season approval blocking, member page wiring, staff page wiring, navigation, and existing Bearforce behavior.
