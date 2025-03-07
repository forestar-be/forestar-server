CREATE VIEW "MachineRentedView" AS
SELECT
  mr.id,
  mr.name,
  mr.maintenance_type,
  mr.nb_day_before_maintenance,
  mr.nb_rental_before_maintenance,
  (
    SELECT
      max(mh."performedAt") AS max
    FROM
      "MaintenanceHistory" mh
    WHERE
      (mh."machineRentedId" = mr.id)
  ) AS last_maintenance_date,
  mr."eventId",
  mr.bucket_name,
  mr.image_path,
  mr.price_per_day,
  mr.guests,
  mr.deposit,
  CASE
    WHEN (
      (
        mr.maintenance_type = 'BY_DAY' :: "MaintenanceType"
      )
      AND (
        (
          SELECT
            max(mh."performedAt") AS max
          FROM
            "MaintenanceHistory" mh
          WHERE
            (mh."machineRentedId" = mr.id)
        ) IS NOT NULL
      )
      AND (mr.nb_day_before_maintenance IS NOT NULL)
    ) THEN (
      (
        SELECT
          max(mh."performedAt") AS max
        FROM
          "MaintenanceHistory" mh
        WHERE
          (mh."machineRentedId" = mr.id)
      ) + (
        (mr.nb_day_before_maintenance) :: double precision * '1 day' :: INTERVAL
      )
    )
    WHEN (
      mr.maintenance_type = 'BY_NB_RENTAL' :: "MaintenanceType"
    ) THEN CASE
      WHEN (
        (
          SELECT
            count(*) AS count
          FROM
            "MachineRental"
          WHERE
            (
              ("MachineRental"."machineRentedId" = mr.id)
              AND (
                "MachineRental"."rentalDate" > (
                  SELECT
                    max(mh."performedAt") AS max
                  FROM
                    "MaintenanceHistory" mh
                  WHERE
                    (mh."machineRentedId" = mr.id)
                )
              )
            )
        ) >= mr.nb_rental_before_maintenance
      ) THEN (
        SELECT
          max("MachineRental"."returnDate") AS max
        FROM
          "MachineRental"
        WHERE
          ("MachineRental"."machineRentedId" = mr.id)
      )
      ELSE NULL :: timestamp without time zone
    END
    ELSE NULL :: timestamp without time zone
  END AS next_maintenance,
  (
    SELECT
      array_agg(DISTINCT dates.day) AS array_agg
    FROM
      (
        "MachineRental" rental
        CROSS JOIN LATERAL (
          SELECT
            (
              generate_series(
                ((rental."rentalDate") :: date) :: timestamp WITH time zone,
                (
                  COALESCE(
                    (rental."returnDate") :: date,
                    (rental."rentalDate") :: date
                  )
                ) :: timestamp WITH time zone,
                '1 day' :: INTERVAL
              )
            ) :: date AS DAY
        ) dates
      )
    WHERE
      (rental."machineRentedId" = mr.id)
  ) AS "forbiddenRentalDays"
FROM
  "MachineRented" mr;