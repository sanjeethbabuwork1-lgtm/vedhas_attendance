# Vedhas Attendance — Staff Geofencing Attendance

You are a senior full-stack engineer and product designer. Build a polished, functional Proof of Concept (POC) for a **school staff geofencing attendance system**.

The purpose of this POC is to demonstrate the core concept to a school/client. It must look professional and actually work on a mobile phone like ios and android using real browser GPS.

Do NOT build unnecessary enterprise features. Prioritize a working end-to-end POC, clean architecture, professional UI, and reliable geofence validation.

---

## 1. Product Concept

The system allows school staff to mark attendance only when they are physically within the school's configured geofence.

Example:

School location:

* Latitude: configurable
* Longitude: configurable
* Geofence radius: 100 meters

Staff flow:

Login
→ Staff Dashboard
→ Get Current Location
→ Verify distance from school
→ If inside geofence → allow Check In
→ If outside geofence → reject Check In
→ Store attendance
→ Display attendance status

Staff should also be able to check out.

Admin can see staff attendance records.

---

# 2. Technology Stack

Use:

* Next.js latest stable version
* TypeScript
* App Router
* Tailwind CSS
* Supabase
* PostgreSQL through Supabase
* Browser Geolocation API
* Lucide React for icons
* React Hook Form where useful
* Zod where useful

Use a clean component-based architecture.

Do NOT introduce unnecessary libraries.

Do NOT use mock data for the core attendance flow if Supabase is configured.

The application must work with real GPS on a mobile browser.

---

# 3. Important POC Scope

Build ONLY these core features:

### Staff

* Login
* Dashboard
* Current attendance status
* Check In
* Check Out
* Current location
* Distance from school
* Geofence status
* Attendance history

### Admin

* Admin login
* Dashboard
* Total staff
* Present today
* Late today
* Absent today
* Attendance table
* Staff name
* Check-in time
* Check-out time
* Working hours
* Location verification result

### School configuration

For the POC, create one school.

Allow the admin to configure:

* School name
* Latitude
* Longitude
* Geofence radius

Default radius:

100 meters

---

# 4. Do NOT Build Yet

Do NOT implement:

* Payroll
* Leave management
* Notifications
* AI
* Background location tracking
* Continuous staff tracking
* Facial recognition
* Biometrics
* Multi-school SaaS
* Subscription billing
* Advanced analytics
* Complex role management
* Native mobile application

These are future phases.

The POC should prove the geofencing attendance concept.

---

# 5. Application Structure

Create these routes:

```text
/login
/staff
/staff/attendance
/staff/history
/admin
/admin/attendance
/admin/settings
```

If a simpler structure is better, you may consolidate pages, but maintain clear separation between Staff and Admin.

---

# 6. Authentication

Use Supabase Authentication.

Create two demo users:

```text
Staff:
staff@demo.com

Admin:
admin@demo.com
```

Do NOT hard-code passwords into frontend code.

Use Supabase Auth.

After login:

```text
staff → /staff
admin → /admin
```

If the user is not authenticated, redirect to `/login`.

---

# 7. Database Design

Create Supabase SQL migrations.

Create these tables.

## profiles

```text
id
user_id
full_name
email
role
school_id
employee_id
created_at
```

Role values:

```text
staff
admin
```

---

## schools

```text
id
name
latitude
longitude
geofence_radius
created_at
updated_at
```

Insert one demo school:

```text
name:
Vedhas Attendance

latitude:
13.0827

longitude:
80.2707

geofence_radius:
100
```

IMPORTANT:

The coordinates above are only demo coordinates.

Make the admin settings page capable of changing them.

---

## attendance

```text
id
staff_id
school_id
attendance_date
check_in_time
check_out_time

check_in_latitude
check_in_longitude
check_in_accuracy

check_out_latitude
check_out_longitude
check_out_accuracy

check_in_distance
check_out_distance

check_in_status
check_out_status

created_at
updated_at
```

Possible status:

```text
present
late
rejected
```

---

# 8. Geofence Algorithm

This is the most important part of the POC.

DO NOT simply compare latitude and longitude values.

Use the Haversine formula to calculate actual distance between:

```text
Staff GPS coordinates
        +
School GPS coordinates
```

Create a reusable utility:

```text
lib/geofence.ts
```

It should expose something similar to:

```typescript
calculateDistance(
  staffLatitude,
  staffLongitude,
  schoolLatitude,
  schoolLongitude
)
```

Return distance in meters.

Also expose:

```typescript
isInsideGeofence(distance, radius)
```

Example:

```text
Distance = 42m
Radius = 100m

42 <= 100

INSIDE
```

Example:

```text
Distance = 183m
Radius = 100m

183 > 100

OUTSIDE
```

---

# 9. GPS Handling

Use the browser's native:

```javascript
navigator.geolocation.getCurrentPosition()
```

Request high accuracy:

```javascript
{
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0
}
```

Display:

```text
Latitude
Longitude
Accuracy
Distance from school
```

Example UI:

```text
Location detected

Latitude:
13.082700

Longitude:
80.270700

GPS Accuracy:
12 meters

Distance from school:
43 meters

● Inside school premises
```

---

# 10. GPS Accuracy Rule

Do NOT accept obviously unreliable GPS.

For the POC:

If GPS accuracy is greater than 50 meters:

Display:

```text
Location accuracy is too low.

Please move to an open area and try again.
```

Do not allow attendance.

Make the value configurable later, but use 50m for the POC.

---

# 11. Check-In Logic

When the staff clicks:

```text
CHECK IN
```

Perform this sequence:

```text
1. Request GPS
2. Get latitude
3. Get longitude
4. Get accuracy
5. Get school coordinates from Supabase
6. Calculate distance
7. Validate GPS accuracy
8. Validate geofence
9. Validate today's attendance
10. If valid → create attendance record
11. Display success
```

If outside:

```text
You are outside the school premises.

Distance:
183 meters

Required:
Within 100 meters

Check-in unavailable.
```

Do NOT create a successful attendance record.

---

# 12. Check-Out Logic

Check-out follows the same location validation.

Staff must be inside the geofence.

If valid:

```text
Check-out recorded

Check-out:
4:42 PM

Working duration:
7h 54m
```

Calculate working duration from:

```text
check_out_time - check_in_time
```

---

# 13. Prevent Duplicate Check-In

A staff member can have only one attendance record per day.

If already checked in:

Do NOT create another record.

Display:

```text
Already checked in today.

Check-in:
8:43 AM
```

If checked in but not checked out:

Show:

```text
CHECK OUT
```

If checked out:

Show:

```text
Attendance completed

8:43 AM → 4:42 PM
7h 59m
```

---

# 14. Late Logic

Create a school attendance start time.

For the POC:

```text
Attendance start:
8:30 AM
```

If staff checks in:

```text
Before or at 8:30 AM
→ Present
```

After:

```text
8:30 AM
→ Late
```

Display late status clearly.

Example:

```text
Present
8:18 AM
```

or:

```text
Late
8:47 AM
```

---

# 15. Staff Dashboard UI

Create a polished modern dashboard.

Header:

```text
Good morning, Arun

Staff ID: STF001
```

Main attendance card:

```text
Today's Attendance

08:43 AM
Checked In

Inside School Premises
42m from school
```

Primary action:

```text
✓ CHECK IN
```

or:

```text
✓ CHECK OUT
```

Use a large mobile-friendly button.

Location card:

```text
Current Location

Latitude     13.082700
Longitude    80.270700
Accuracy     12m

Distance     42m

🟢 Inside Geofence
```

Attendance timeline:

```text
Today

08:43 AM
Check In
School premises

04:42 PM
Check Out
School premises
```

---

# 16. Staff History Page

Display:

```text
Attendance History

Date        Check In    Check Out    Hours    Status

13 Aug      8:43 AM     4:42 PM      7h 59m   Present
12 Aug      8:51 AM     4:38 PM      7h 47m   Late
11 Aug      8:27 AM     4:35 PM      8h 08m   Present
```

Use responsive cards on mobile and a table on desktop.

---

# 17. Admin Dashboard

Create a professional admin dashboard.

Top cards:

```text
Total Staff
25
```

```text
Present Today
21
```

```text
Late Today
3
```

```text
Absent Today
1
```

Attendance table:

```text
Staff
Employee ID
Check In
Check Out
Working Hours
Status
Location
```

Example:

```text
Arun Kumar
STF001
8:43 AM
4:42 PM
7h 59m
Present
42m
```

Location status should be:

```text
Verified
```

or:

```text
Rejected
```
the admin should all the fields column of report in xls include that option as well

Update the existing Staff Geofencing Attendance POC. Do NOT rebuild the project from scratch and do NOT remove any existing functionality.Focus ONLY on improving the Admin Dashboard attendance filtering and reporting experience.1. Date Range FilterAdd a professional date-range filter at the top of the Admin Dashboard.The admin should be able to select:From DateTo DateExample:Attendance Report  From: [ 01 Aug 2026 ] To:   [ 13 Aug 2026 ]  [ Apply Filter ] When the date range changes, all attendance statistics and the attendance table must update based on the selected date range.Default:From Date = todayTo Date = todayDo not reload the entire page unnecessarily. Use efficient database queries.2. Staff FilterAdd a staff filter.The admin should be able to select:Staff: [ All Staff ▼ ] The dropdown should contain all staff members belonging to the school.Example:All Staff Arun Kumar Priya Sharma Karthik Divya When a staff member is selected, show attendance only for that staff member.Allow the admin to return to:All Staff 3. Attendance Status FilterAdd a status filter:Status: [ All ▼ ] Options:All Present Late Absent The admin should be able to combine this with the date and staff filters.Examples:From: 01 Aug To: 13 Aug Staff: All Staff Status: Late This should show only late attendance records during that period.Another example:From: 01 Aug To: 13 Aug Staff: Arun Kumar Status: Present This should show only Arun Kumar's present records.4. Filter CombinationAll filters must work together.Filtering logic:Date Range     + Staff     + Status     ↓ Filtered Attendance Results Do not implement each filter independently in a way that overrides the others.The final query should respect all selected filters.5. Dashboard StatisticsThe dashboard summary cards must dynamically update according to the selected filters.Display:Total Staff Present Late Absent For example, if the admin selects:01 Aug → 13 Aug Staff → Arun Kumar the statistics should represent Arun Kumar for that date range.If:Staff → All Staff Status → Late the results should reflect the filtered dataset.Be careful with the meaning of Total Staff.For the normal unfiltered dashboard:Total Staff = total active staff in the school When a specific staff member is selected:Total Staff = 1 Do not incorrectly count attendance rows as staff members.6. Absent CalculationImportant:Absent staff may not have an attendance record.Therefore, do NOT calculate absence simply by filtering:attendance.status = 'absent' Instead, determine absence using:Expected working day + Active staff - Staff who have attendance for that day For the POC:Monday–Friday = working daysSaturday/Sunday = not working daysFor each working day in the selected date range:If staff has valid attendance:     Present or Late Else:     Absent Do not count weekends as absent.Structure the code so holidays can be added later.7. Attendance TableImprove the existing Admin attendance table.Columns:Date Staff Employee ID Check In Check Out Working Hours Status Distance Location Example:13 Aug 2026 Arun Kumar STF001 8:43 AM 4:42 PM 7h 59m Present 42m Verified For absent staff:13 Aug 2026 Priya Sharma STF002 — — — Absent — — For late:12 Aug 2026 Karthik STF003 8:57 AM 4:41 PM 7h 44m Late 38m Verified 8. Clear FiltersAdd:[ Clear Filters ] This should restore:Date: Today Staff: All Staff Status: All and refresh the dashboard.9. Filter UIMake the filter section visually professional.Desktop:┌─────────────────────────────────────────────────────────────┐ │ Attendance Filters                                          │ │                                                             │ │ From Date     To Date       Staff          Status           │ │ [01 Aug]      [13 Aug]      [All Staff ▼] [All ▼]          │ │                                                             │ │ [Apply Filters]                    [Clear Filters]           │ └─────────────────────────────────────────────────────────────┘ On mobile, stack the filters vertically.Use proper date inputs or a date-picker component already available in the project.Do not add unnecessary dependencies unless required.10. PerformanceDo not fetch every attendance record and perform all filtering in the browser if the database can perform the filtering.Prefer Supabase/PostgreSQL queries with:school_id date range staff_id status However, absence calculation may require generating the expected staff/date combinations.Keep the implementation reasonably efficient for the POC.11. URL StateIf practical, preserve filters in URL query parameters:/admin?from=2026-08-01&to=2026-08-13&staff=staff-id&status=late This is preferred but not mandatory for the POC.It allows the admin to refresh/share the current filtered view without losing the selected filters.12. Empty StateIf there are no matching records, show a professional empty state:No attendance records found  Try changing the selected date range, staff member, or attendance status. Do not show an empty/broken table.13. ImportantDo NOT change:Staff loginStaff dashboardGPS functionalityGeofencingCheck-inCheck-outExisting authenticationExisting database structure unless a small change is genuinely requiredOnly enhance the Admin Dashboard and related attendance query/logic.Before finishing:Verify all

---

# 18. Admin Settings

Create:

```text
School Settings

School Name
[ Vedhas Attendance ]

Latitude
[ 13.0827 ]

Longitude
[ 80.2707 ]

Geofence Radius
[ 100 ] meters

Attendance Start Time
[ 08:30 ]

GPS Accuracy Limit
[ 50 ] meters
```

Save button:

```text
Save Settings
```

Persist these values in Supabase.

---

# 19. Design Requirements

The UI must look like a real commercial SaaS product.

Do NOT make it look like a basic student project.

Design style:

* Modern
* Clean
* Professional
* Minimal
* Responsive
* Mobile-first for staff
* Desktop-first for admin
* Good whitespace
* Rounded cards
* Subtle shadows
* Clear typography
* Accessible contrast

Use a professional blue/indigo-based visual identity.

Do not overuse gradients.

Do not use excessive animations.

Use Lucide icons.

---

# 20. Location Status Design

Use clear visual states.

### Inside

```text
🟢 Inside School
42m away
```

### Outside

```text
🔴 Outside School
183m away
```

### Poor GPS

```text
🟡 Low GPS Accuracy
Accuracy: 87m
```

### Loading

```text
Getting your location...
```

### Permission denied

```text
Location permission is required
to mark attendance.
```

Give clear instructions for enabling location.

---

# 21. Security

Do not trust the frontend.

The frontend can calculate distance for UI feedback, but the final attendance decision should be validated server-side.

Create a server-side/API/Edge Function mechanism that:

```text
receives:
staff_id
latitude
longitude
accuracy

retrieves:
school latitude
school longitude
radius

calculates:
distance

validates:
accuracy
geofence
attendance status

then:
creates attendance record
```

Never allow the frontend to directly insert an arbitrary "present" attendance record.

Use Supabase Row Level Security.

Staff should only be able to read their own attendance.

Admin should be able to read attendance for the school.

---

# 22. Auditability

Store:

```text
latitude
longitude
accuracy
distance
timestamp
```

for every successful check-in/check-out.

This allows the school to understand why an attendance action was accepted.

---

# 23. Error Handling

Handle:

### GPS permission denied

```text
Location permission denied.

Please enable location permission
and try again.
```

### GPS timeout

```text
Unable to determine your location.

Please try again.
```

### Outside geofence

```text
You are outside the allowed school area.
```

### Poor accuracy

```text
GPS accuracy is too low.
Please try again.
```

### Already checked in

```text
You have already checked in today.
```

### Network error

```text
Unable to connect to the server.
Please try again.
```

Never show raw technical errors to the user.

Log useful errors for debugging.

---

# 24. Mobile Responsiveness

The staff application must work well on:

* Android Chrome
* iPhone Safari
* Desktop browser

Make buttons large enough for touch.

The main Check In / Check Out action should be immediately visible.

---

# 25. Demo Mode

Because this is a POC, create a clearly labeled:

```text
DEMO MODE
```

option for development/testing.

However, the actual geofencing demo must use real browser GPS when possible.

Do NOT fake successful GPS results in the normal flow.

For local desktop development where GPS may not be available, provide a development-only test mechanism that can be disabled in production.

---

# 26. Seed Data

Create seed/demo data:

School:

```text
Vedhas Attendance
```

Staff:

```text
Arun Kumar
STF001
staff@demo.com
```

Admin:

```text
School Admin
ADM001
admin@demo.com
```

Create several historical attendance records so the admin dashboard doesn't look empty.

Clearly label seed/demo data.

---

# 27. Environment Variables

Create:

```text
.env.local.example
```

with:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Never commit actual secrets.

---

# 28. Project Structure

Use a clean structure similar to:

```text
src/
├── app/
│   ├── login/
│   ├── staff/
│   │   ├── page.tsx
│   │   ├── attendance/
│   │   └── history/
│   ├── admin/
│   │   ├── page.tsx
│   │   ├── attendance/
│   │   └── settings/
│   └── api/
│
├── components/
│   ├── ui/
│   ├── staff/
│   ├── admin/
│   └── attendance/
│
├── lib/
│   ├── supabase/
│   ├── geofence.ts
│   ├── location.ts
│   └── attendance.ts
│
└── types/
```

Adapt this structure if needed.

---

# 29. Important Development Rule

Build incrementally.

Do NOT generate a huge amount of broken code at once.

First:

1. Set up project
2. Verify it runs
3. Build authentication
4. Build staff dashboard
5. Build GPS functionality
6. Build geofence calculation
7. Build attendance API
8. Connect Supabase
9. Build admin dashboard
10. Test end-to-end

After each major stage, check for TypeScript/build errors.

Run:

```bash
npm run lint
```

and:

```bash
npm run build
```

before considering the project complete.

Fix all TypeScript, lint, and build errors.

---

# 30. POC Acceptance Criteria

The POC is complete only when this exact scenario works:

### Scenario A — Inside school

Staff opens the app.

The app obtains real GPS.

Example:

```text
Distance:
43 meters

Geofence:
100 meters

Accuracy:
12 meters
```

The app displays:

```text
🟢 Inside School Premises
```

Staff taps:

```text
CHECK IN
```

Backend validates the location.

Attendance is stored in Supabase.

UI displays:

```text
✓ Attendance marked

Check-in:
8:43 AM
```

---

### Scenario B — Outside school

Staff is outside the geofence.

Example:

```text
Distance:
183 meters
```

The app displays:

```text
🔴 Outside School Premises
```

Check-in must be disabled/rejected.

No successful attendance record should be created.

---

### Scenario C — Check out

Staff is inside the geofence.

Staff taps:

```text
CHECK OUT
```

Backend validates location.

Attendance gets:

```text
check_out_time
check_out_latitude
check_out_longitude
check_out_accuracy
check_out_distance
```

Dashboard calculates working hours.

---

### Scenario D — Admin

Admin logs in.

Admin can see:

```text
Total Staff
Present
Late
Absent
```

and today's attendance records.

---

# 31. Final Demo Experience

The final POC should allow me to demonstrate this to a school:

```text
STAFF PHONE

Login
   ↓
Staff Dashboard
   ↓
"Check In"
   ↓
📍 Detecting location...
   ↓
Distance: 42m
Accuracy: 11m
   ↓
🟢 Inside School
   ↓
CHECK IN
   ↓
✅ Attendance Marked
   ↓
8:43 AM
```

Then show:

```text
ADMIN DASHBOARD

Arun Kumar
STF001

Check-in: 8:43 AM
Location: Verified
Distance: 42m
Status: Present
```

This should look convincing as a real product demonstration.

---

# 32. Future Architecture Notes

Keep the code structured so these can be added later:

* Multiple schools
* Multiple campuses
* Staff shifts
* Leave management
* Holidays
* Payroll integration
* Notifications
* Background geofencing
* Native Android/iOS app
* QR verification
* Device binding
* Anti-location-spoofing
* Reports
* CSV/Excel export
* Parent/student modules
* AI attendance analytics
* SaaS multi-tenancy

Do NOT implement these now.

---

# 33. Final Instruction

Act as the senior engineer responsible for delivering this POC.

Do not just describe the implementation.

**Actually create and modify the project files.**

Before finishing:

1. Ensure the app runs.
2. Ensure TypeScript has no errors.
3. Ensure lint passes.
4. Ensure production build passes.
5. Verify Supabase integration.
6. Verify GPS functionality.
7. Verify Haversine distance calculation.
8. Verify geofence validation.
9. Verify check-in.
10. Verify check-out.
11. Verify admin attendance display.
12. Make the UI polished and responsive.

If something is ambiguous, choose the simplest production-quality approach that satisfies the POC requirements instead of stopping to ask unnecessary questions.

---

# Superadmin and account setup

The app uses Employee ID and password for sign-in. Supabase Auth requires an
email identifier, so the server creates a random internal `@accounts.example.com`
alias for each account. It is not a real mailbox, is not shown as a login ID,
and no email is sent.

For an existing database, run these migrations in order in the Supabase SQL
Editor:

1. [`supabase/migrations/20261112170000_superadmin_auth.sql`](./supabase/migrations/20261112170000_superadmin_auth.sql)
2. [`supabase/migrations/20261112194700_admin_access_scope.sql`](./supabase/migrations/20261112194700_admin_access_scope.sql)
3. [`supabase/migrations/20261112194800_manual_attendance_and_pay_period.sql`](./supabase/migrations/20261112194800_manual_attendance_and_pay_period.sql)
4. [`supabase/migrations/20261112194900_admin_expenses_upcoming_off.sql`](./supabase/migrations/20261112194900_admin_expenses_upcoming_off.sql)

For a new database, run `supabase/schema.sql` first, then all four migrations in
order. The base schema stays locked until the migrations install the
role-based Row Level Security policies.

Configure these Vercel Production environment variables before deployment:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Use the Supabase publishable/anon key for
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, not the secret or service-role key. Account
management stays in a Supabase Edge Function so the static web export and
Capacitor mobile build continue to work.

Deploy the function and set its one-time secret using Supabase CLI:

```text
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set SUPERADMIN_SETUP_CODE=YOUR_RANDOM_32_CHARACTER_OR_LONGER_VALUE
supabase functions deploy manage-accounts
```

Supabase supplies `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. If the function
reports that it is missing, add the service-role key only to Supabase Function
secrets. Do not copy that key into Vercel, the browser, or source control. The `manage-accounts`
function disables gateway JWT verification because first-user setup has no
session; it validates the one-time setup code itself and verifies the signed
Supabase user and superadmin role for every other action.

After applying the migration and deploying the function:

1. Open `/superadmin-setup`.
2. Enter the configured setup code and choose a password of at least 12
   characters. This can only create the first `superadmin@vc` account once.
3. Sign in at `/login` using Employee ID `superadmin@vc` and that password.
4. Open Staff Management and set passwords for existing accounts such as
   `admin@vc`. Add new staff there and give each person their Employee ID and
   password securely.
5. Remove the `SUPERADMIN_SETUP_CODE` function secret after setup:

   ```text
   supabase secrets unset SUPERADMIN_SETUP_CODE
   ```

Regular admins can open the dashboard, download attendance reports, manage
allowances and advances, and approve or reject upcoming leave requests.
Permission requests, staff, payroll, and settings remain superadmin-only. The
superadmin can manage staff and passwords, configure attendance, approve leave
and permission requests, and manage payroll.

The Superadmin can manually mark a staff member Present from Attendance Report.
The action requires a reason, preserves any existing check-in details, and
leaves missing time/location blank instead of fabricating GPS verification.
Payroll accepts an inclusive date range; each month's salary rate is prorated
using that month's working days, with attendance, approved leave, absences,
fines, and dated advances applied to the selected period. The single "Need to
Pay" summary shows net salary after absences, fines, and advances. Allowances
are shown separately in the per-staff table and are not included in that total.

At the end, provide:

* What was built
* Files/components created
* Environment variables required
* Supabase setup instructions
* How to run locally
* How to test GPS on a phone
* Any limitations of this POC
* Recommended next steps for converting it into a production application
