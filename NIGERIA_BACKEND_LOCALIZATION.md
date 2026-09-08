# QuickRide Nigeria backend localization

This copy keeps the existing API route structure so it remains compatible with the Nigeria-localized frontend.

## Changed

- Map/geocoder searches default to Nigeria (`ng`) and a Nigeria bounding box.
- Known-place fallbacks now include Lagos, Abuja, Port Harcourt, Ibadan, Kano, Benin City, Enugu, Owerri, Abeokuta, Kaduna, Ilorin and Jos.
- Map distance text uses metres/kilometres instead of feet/miles.
- Ride market is Nigeria with `NGN` / `₦`.
- Fare calculation uses kilometres and configurable NGN fare values.
- Ride and withdrawal models now support NGN, with NGN as the default. Legacy USD/CAD enum values remain for old records.
- User and driver registration/profile routes accept common Nigerian input forms and store new numbers as E.164 (`+234...`). The schema remains tolerant of legacy records so an existing database does not become unreadable.
- New driver default coordinates are Lagos.
- Server log/chat date formatting now uses the `Africa/Lagos` timezone.
- Driver travelled-distance statistics are accumulated in kilometres.
- Driver earnings responses now report NGN.
- Withdrawal requests default to NGN and support `bankCode` while retaining `routingNumber` for frontend/API compatibility.
- Canada/US-specific vehicle error text was removed. Existing vehicle types remain `car` and `bike` because that is what the frontend currently sends.

## Fare configuration

The included fare values are demo defaults, not a claim about live Nigerian market pricing. Configure these environment variables before production:

- `FARE_BIKE_BASE_NGN`
- `FARE_BIKE_PER_KM_NGN`
- `FARE_BIKE_PER_MIN_NGN`
- `FARE_BIKE_MIN_NGN`
- `FARE_CAR_BASE_NGN`
- `FARE_CAR_PER_KM_NGN`
- `FARE_CAR_PER_MIN_NGN`
- `FARE_CAR_MIN_NGN`

## Still required for production

1. Add a real Nigeria payment gateway flow (for example Paystack or Flutterwave) for card/bank-transfer payments if cash-only is not desired. This backend currently has ride payment fields but no gateway implementation.
2. Add automatic payout integration and bank-account verification if driver payouts should be processed without admin action.
3. Define city-specific vehicle eligibility and regulatory/document requirements.
4. Replace public Nominatim/OSRM endpoints with production-capable providers or self-hosted services if traffic/usage grows.
5. Store uploaded driver documents in object storage instead of base64 payloads in requests for production scale.
6. Add fare surge, tolls, waiting fees, cancellation fees and city-specific pricing rules as needed.
7. Run a data migration if existing captain `kmTravelled` values actually contain miles from the old Canada/US build.
8. If reusing an old database, normalize legacy phone numbers separately; new public registrations/updates are already enforced as Nigerian numbers.


## Cash now, card-ready later

- Passenger rides currently use cash as the only enabled payment method.
- `Ride.paymentMethod` supports both `cash` and `card` so historical/data migrations are not needed when card is integrated later.
- New payment tracking fields include `paymentStatus`, `paymentProvider`, and `paymentReference`.
- `GET /ride/payment-methods` exposes payment availability to the frontend. Cash is enabled and card is returned as `coming_soon`.
- The backend rejects card ride creation while the gateway is not implemented, even if somebody manually changes the frontend request.
- Cash rides cannot be completed until the driver explicitly confirms cash collection.
- Driver withdrawable balance contains platform-funded balances such as bonuses, not fares already collected directly in cash.

When a gateway is added later, integrate transaction initialization/webhooks in `services/payment.service.js`, mark successful card rides as `paid`, then enable the card method.
