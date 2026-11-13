                  <section className="mt-7">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ff8b38]">Next Session</p>
                        <h3 className="mt-1 text-xl font-extrabold md:text-2xl">Upcoming Sessions</h3>
                      </div>
                      <Link href="/member/schedule" className="rounded-full bg-[#ff7a1a] px-4 py-2 text-xs font-bold transition hover:bg-[#ff8b38] md:text-sm">
                        Manage Schedule
                      </Link>
                    </div>

                    {!nextBooking || !nextSessionVisual ? (
                      <div className="relative min-h-[260px] overflow-hidden rounded-[24px] border border-white/10 bg-[#191919]">
                        <img src="/better-form.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" style={{ objectPosition: "center 30%" }} />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/45" />
                        <div className="relative flex min-h-[260px] flex-col items-center justify-center px-6 py-8 text-center">
                          <CalendarDays className="text-[#ff7a1a]" size={32} />
                          <h4 className="mt-3 text-xl font-bold">No confirmed sessions yet</h4>
                          <p className="mx-auto mt-2 max-w-lg text-sm text-white/55">Once your next session is confirmed, its session image, coach, branch, date, time, and countdown will appear here.</p>
                          <Link href="/member/schedule" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#202020] transition hover:bg-white/90">
                            Book a Session
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <>
                        <article className="relative min-h-[500px] overflow-hidden rounded-[26px] border border-white/10 bg-black shadow-xl shadow-black/30 md:min-h-[460px] lg:min-h-[430px]">
                          <img
                            src={nextSessionVisual.image}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{ objectPosition: nextSessionVisual.position }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-black/25 lg:from-black lg:via-black/75 lg:to-black/5" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />

                          <div className="relative flex min-h-[500px] flex-col justify-between p-5 md:min-h-[460px] md:p-7 lg:min-h-[430px] lg:p-8">
                            <div className="flex items-center justify-between gap-3">
                              <span className="inline-flex rounded-full bg-[#ff7a1a] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white">Confirmed</span>
                              <span className="hidden rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[11px] font-semibold text-white/65 backdrop-blur-sm sm:inline-flex">
                                BearFit scheduled session
                              </span>
                            </div>

                            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-8">
                              <div className="max-w-3xl">
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Your next workout</p>
                                <h4 className="mt-2 text-4xl font-black leading-[0.95] sm:text-5xl lg:text-6xl">{formatSessionTitle(nextBooking.session_label, nextBooking.session_type)}</h4>
                                <div className="mt-5 grid gap-2 text-sm text-white/75 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2 md:text-base">
                                  <span className="inline-flex items-center gap-2"><MapPin size={17} className="text-[#ff7a1a]" /> {nextBooking.branch}</span>
                                  <span className="inline-flex items-center gap-2"><Clock3 size={17} className="text-[#ff7a1a]" /> {formatDateTime(nextBookingStart)}</span>
                                </div>
                                <p className="mt-3 text-base font-extrabold text-[#ff9b54]">Coach {nextBooking.assigned_coach_user_id ? coachNames[nextBooking.assigned_coach_user_id] || "Coach assigned" : "Any available coach"}</p>
                              </div>

                              <div className="lg:w-[360px]">
                                <div className="rounded-[22px] border border-white/15 bg-[#111111]/95 p-3 sm:p-4">
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/55">{sessionCountdown.label}</p>
                                    <Clock3 size={15} className="text-[#ff9b54]" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <CountdownCell label="Days" value={sessionCountdown.days} />
                                    <CountdownCell label="Hours" value={sessionCountdown.hours} />
                                    <CountdownCell label="Minutes" value={sessionCountdown.minutes} />
                                    <CountdownCell label="Seconds" value={sessionCountdown.seconds} />
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                                  <Link href="/member/schedule" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-[#202020] transition hover:bg-white/90">
                                    Session details <ChevronRight size={16} />
                                  </Link>
                                  <Link href="/member/schedule" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-black/35 px-5 py-3 text-sm font-bold text-white/80 backdrop-blur-sm transition hover:bg-black/50">
                                    Manage booking
                                  </Link>
                                </div>
                                <p className="mt-2 text-center text-[11px] font-medium text-white/45">Check-in is completed by BearFit staff.</p>
                              </div>
                            </div>
                          </div>
                        </article>

                        {confirmedBookings.length > 1 && (
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {confirmedBookings.slice(1).map((booking) => (
                              <Link key={booking.id} href="/member/schedule" className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#1b1b1b] px-4 py-3 transition hover:bg-[#202020]">
                                <div className="min-w-0">
                                  <p className="truncate font-bold">{formatSessionTitle(booking.session_label, booking.session_type)}</p>
                                  <p className="mt-1 truncate text-xs text-white/45">{formatDateTime(booking.start_at || booking.requested_start_at)} · {booking.branch}</p>
                                </div>
                                <ChevronRight className="shrink-0 text-[#ff7a1a]" size={18} />
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </section>

                  <section id="payments" className="mt-7 overflow-hidden rounded-[24px] border border-white/[0.04] bg-[#171717]">
                    <div className="flex items-center justify-between gap-3 px-4 pt-5 md:px-5">
                      <div>
                        <h3 className="text-xl font-extrabold">Member Activity</h3>
                        <p className="mt-1 text-sm text-white/40">Your real session and payment history</p>
                      </div>
                      <Activity size={22} className="text-[#ff7a1a]" />
                    </div>

                    <div className="mt-4 grid grid-cols-3 border-y border-white/10 px-3 text-center text-xs font-semibold text-white/45 md:px-5">
                      <span className="border-b-2 border-[#ff7a1a] py-3 text-white">Activity Log</span>
                      <span className="py-3">Sessions</span>
                      <span className="py-3">Payments</span>
                    </div>

                    <div className="p-3 md:p-5">
                      {activityItems.length === 0 ? (
                        <EmptyState text="Your completed sessions and payments will appear here." />
                      ) : (
                        <div className="space-y-2 sm:space-y-0 sm:divide-y sm:divide-white/[0.06]">
                          {activityItems.map((item) => (
                            <div key={item.id} className="grid gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.025] px-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0">
                              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.kind === "session" ? "bg-[#ff7a1a] text-white" : "bg-emerald-500/15 text-emerald-300"}`}>
                                {item.kind === "session" ? <Dumbbell size={20} /> : <ReceiptText size={20} />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold">{item.title}</p>
                                <p className={`mt-1 text-xs font-semibold ${item.kind === "session" ? "text-[#ff9b54]" : "text-emerald-400"}`}>
                                  {item.kind === "session" ? "Session used" : "Payment received"}
                                </p>
                                <p className="mt-1 truncate text-xs text-white/35">{item.detail}</p>
                              </div>
                              <div className="text-left sm:text-right">
                                <p className="text-xs text-white/40">{formatDateTime(item.timestamp)}</p>
                                {item.kind === "session" ? (
                                  <p className="mt-1 font-bold text-[#ff9b54]">{item.sessionsLeft} left</p>
                                ) : (
                                  <>
                                    <p className="mt-1 font-bold">{formatMoney(item.amount)}</p>
                                    {item.status && <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusClass(item.status)}`}>{item.status}</span>}
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="mt-7">
                    <h3 className="mb-3 text-lg font-extrabold">Updates & Promos</h3>
                    <section className="relative min-h-[250px] overflow-hidden rounded-[24px] border border-orange-300/20">
                      <img src="/onboarding/better-form1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 38%" }} />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#ff6b0a]/95 via-[#ff7316]/90 to-[#ff8a2a]/75" />
                      <div className="relative p-6 md:p-8">
                        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/80">Schedule</p>
                        <h3 className="mt-2 text-2xl font-black md:text-3xl">Book your next session</h3>
                        <p className="mt-2 max-w-2xl text-sm text-white/85 md:text-base">View available BearFit slots, choose your coach, or send a custom session request.</p>
                        <Link href="/member/schedule" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#202020] transition hover:bg-white/90">
                          Open Schedule
                        </Link>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            )}

          </div>
    </div>
  )
}

function CountdownCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-2 py-3 text-center">
      <p className="text-2xl font-black tabular-nums text-white sm:text-3xl lg:text-2xl">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">{label}</p>
    </div>
  )
}

function ProgressionCard({
  icon: Icon,
  label,
  value,
  sublabel,
  progress,
  href,
}: {
  icon: typeof Home
  label: string
  value: string
  sublabel: string
  progress: number
  href?: string
}) {
  const content = (
    <div className="min-w-0 rounded-[20px] border border-white/[0.05] bg-[#242424] p-4 transition hover:border-[#ff7a1a]/25 hover:bg-[#282828] md:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-white/55 sm:text-sm">{label}</p>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ff7a1a]/15 text-[#ff8b38]">
          <Icon size={16} />
        </div>
      </div>
      <p className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-2 min-h-8 text-[11px] leading-4 text-white/45 sm:text-xs">{sublabel}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#ff6b0a] to-[#ff9b54]" style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} />
      </div>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 px-4 py-7 text-center text-sm text-white/40">{text}</div>
}


                  <section id="payments" className="mt-7 overflow-hidden rounded-[24px] border border-white/[0.04] bg-[#171717]">
                    <div className="flex items-center justify-between gap-3 px-4 pt-5 md:px-5">
                      <div>
                        <h3 className="text-xl font-extrabold">Member Activity</h3>
                        <p className="mt-1 text-sm text-white/40">Your real session and payment history</p>
                      </div>
                      <Activity size={22} className="text-[#ff7a1a]" />
                    </div>

                    <div className="mt-4 grid grid-cols-3 border-y border-white/10 px-3 text-center text-xs font-semibold text-white/45 md:px-5">
                      <span className="border-b-2 border-[#ff7a1a] py-3 text-white">Activity Log</span>
                      <span className="py-3">Sessions</span>
                      <span className="py-3">Payments</span>
                    </div>

                    <div className="p-3 md:p-5">
                      {activ                  <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(260px,0.78fr)_minmax(0,1.5fr)] xl:items-stretch">
                  <section className="flex h-full min-h-[265px] flex-col items-center justify-center rounded-[22px] border border-white/[0.07] bg-[#1c1c1c] px-5 py-6 text-center md:px-7">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-400">Membership ID</p>
                    <p className="mt-1 break-words text-4xl font-black tracking-tight md:text-5xl">{membershipId}</p>
                    <p className="mt-2 flex items-center justify-center gap-2 text-lg text-white/55 md:text-xl">
                      <MapPin size={18} className="text-[#ff7a1a]" /> {branch}
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                      <span className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${statusClass(membershipStatus)}`}>
                        Membership: {membershipStatus}
                      </span>
                      <span className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${statusClass(paymentStatus)}`}>
                        Payment: {paymentStatus}
                      </span>
                    </div>
                  </section>

                  <section className="min-w-0">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ff8b38]">Next Session</p>
                        <h3 className="mt-1 text-xl font-extrabold md:text-2xl">Upcoming Sessions</h3>
                      </div>
                      <Link href="/member/schedule" className="rounded-full bg-[#ff7a1a] px-4 py-2 text-xs font-bold transition hover:bg-[#ff8b38] md:text-sm">
                        Manage Schedule
                      </Link>
                    </div>

                    {!nextBooking || !nextSessionVisual ? (
                      <div className="relative min-h-[260px] overflow-hidden rounded-[24px] border border-white/10 bg-[#191919]">
                        <img src="/better-form.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" style={{ objectPosition: "center 30%" }} />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/45" />
                        <div className="relative flex min-h-[260px] flex-col items-center justify-center px-6 py-8 text-center">
                          <CalendarDays className="text-[#ff7a1a]" size={32} />
                          <h4 className="mt-3 text-xl font-bold">No confirmed sessions yet</h4>
                          <p className="mx-auto mt-2 max-w-lg text-sm text-white/55">Once your next session is confirmed, its session image, coach, branch, date, time, and countdown will appear here.</p>
                          <Link href="/member/schedule" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#202020] transition hover:bg-white/90">
                            Book a Session
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <>
                        <article className="relative min-h-[400px] overflow-hidden rounded-[26px] border border-white/10 bg-black shadow-xl shadow-black/30 md:min-h-[400px] lg:min-h-[400px]">
                          <img
                            src={nextSessionVisual.image}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{ objectPosition: nextSessionVisual.position }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-black/25 lg:from-black lg:via-black/75 lg:to-black/5" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />

                          <div className="relative flex min-h-[400px] flex-col justify-between p-5 md:min-h-[400px] md:p-7 lg:min-h-[400px] lg:p-8">
                            <div className="flex items-center justify-between gap-3">
                              <span className="inline-flex rounded-full bg-[#ff7a1a] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white">Confirmed</span>
                              <span className="hidden rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[11px] font-semibold text-white/65 backdrop-blur-sm sm:inline-flex">
                                BearFit scheduled session
                              </span>
                            </div>

                            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-8">
                              <div className="max-w-3xl">
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Your next workout</p>
                                <h4 className="mt-2 text-4xl font-black leading-[0.95] sm:text-5xl lg:text-4xl">{formatSessionTitle(nextBooking.session_label, nextBooking.session_type)}</h4>
                                <div className="mt-5 grid gap-2 text-sm text-white/75 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2 md:text-base">
                                  <span className="inline-flex items-center gap-2"><MapPin size={17} className="text-[#ff7a1a]" /> {nextBooking.branch}</span>
                                  <span className="inline-flex items-center gap-2"><Clock3 size={17} className="text-[#ff7a1a]" /> {formatDateTime(nextBookingStart)}</span>
                                </div>
                                <p className="mt-3 text-base font-extrabold text-[#ff9b54]">Coach {nextBooking.assigned_coach_user_id ? coachNames[nextBooking.assigned_coach_user_id] || "Coach assigned" : "Any available coach"}</p>
                              </div>

                              <div className="xl:w-[235px]">
                                <div className="rounded-[22px] border border-white/15 bg-[#111111]/95 p-3 sm:p-4">
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/55">{sessionCountdown.label}</p>
                                    <Clock3 size={15} className="text-[#ff9b54]" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <CountdownCell label="Days" value={sessionCountdown.days} />
                                    <CountdownCell label="Hours" value={sessionCountdown.hours} />
                                    <CountdownCell label="Minutes" value={sessionCountdown.minutes} />
                                    <CountdownCell label="Seconds" value={sessionCountdown.seconds} />
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                                  <Link href="/member/schedule" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-[#202020] transition hover:bg-white/90">
                                    Session details <ChevronRight size={16} />
                                  </Link>
                                  <Link href="/member/schedule" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-black/35 px-5 py-3 text-sm font-bold text-white/80 backdrop-blur-sm transition hover:bg-black/50">
                                    Manage booking
                                  </Link>
                                </div>
                                <p className="mt-2 text-center text-[11px] font-medium text-white/45">Check-in is completed by BearFit staff.</p>
                              </div>
                            </div>
                          </div>
                        </article>

                        {confirmedBookings.length > 1 && (
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {confirmedBookings.slice(1).map((booking) => (
                              <Link key={booking.id} href="/member/schedule" className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#1b1b1b] px-4 py-3 transition hover:bg-[#202020]">
                                <div className="min-w-0">
                                  <p className="truncate font-bold">{formatSessionTitle(booking.session_label, booking.session_type)}</p>
                                  <p className="mt-1 truncate text-xs text-white/45">{formatDateTime(booking.start_at || booking.requested_start_at)} · {booking.branch}</p>
                                </div>
                                <ChevronRight className="shrink-0 text-[#ff7a1a]" size={18} />
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </section>
                  </div>[#ff9b54]" : "text-emerald-400"}`}>
                                  {item.kind === "session" ? "Session used" : "Payment received"}
                                </p>
                                <p className="mt-1 truncate text-xs text-white/35">{item.detail}</p>
                              </div>
                              <div className="text-left sm:text-right">
                                <p className="text-xs text-white/40">{formatDateTime(item.timestamp)}</p>
                                {item.kind === "session" ? (
                                  <p className="mt-1 font-bold text-[#ff9b54]">{item.sessionsLeft} left</p>
                                ) : (
                                  <>
                                    <p className="mt-1 font-bold">{formatMoney(item.amount)}</p>
                                    {item.status && <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusClass(item.status)}`}>{item.status}</span>}
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="mt-7">
                    <h3 className="mb-3 text-lg font-extrabold">Updates & Promos</h3>
                    <section className="relative min-h-[250px] overflow-hidden rounded-[24px] border border-orange-300/20">
                      <img src="/onboarding/better-form1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 38%" }} />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#ff6b0a]/95 via-[#ff7316]/90 to-[#ff8a2a]/75" />
                      <div className="relative p-6 md:p-8">
                        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/80">Schedule</p>
                        <h3 className="mt-2 text-2xl font-black md:text-3xl">Book your next session</h3>
                        <p className="mt-2 max-w-2xl text-sm text-white/85 md:text-base">View available BearFit slots, choose your coach, or send a custom session request.</p>
                        <Link href="/member/schedule" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#202020] transition hover:bg-white/90">
                          Open Schedule
                        </Link>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            )}

          </div>
    </div>
  )
}

function CountdownCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-2 py-3 text-center">
      <p className="text-2xl font-black tabular-nums text-white sm:text-3xl lg:text-2xl">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">{label}</p>
    </div>
  )
}

function ProgressionCard({
  icon: Icon,
  label,
  value,
  sublabel,
  progress,
  href,
}: {
  icon: typeof Home
  label: string
  value: string
  sublabel: string
  progress: number
  href?: string
}) {
  const content = (
    <div className="min-w-0 rounded-[20px] border border-white/[0.05] bg-[#242424] p-4 transition hover:border-[#ff7a1a]/25 hover:bg-[#282828] md:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-white/55 sm:text-sm">{label}</p>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ff7a1a]/15 text-[#ff8b38]">
          <Icon size={16} />
        </div>
      </div>
      <p className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-2 min-h-8 text-[11px] leading-4 text-white/45 sm:text-xs">{sublabel}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#ff6b0a] to-[#ff9b54]" style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} />
      </div>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 px-4 py-7 text-center text-sm text-white/40">{text}</div>
}
