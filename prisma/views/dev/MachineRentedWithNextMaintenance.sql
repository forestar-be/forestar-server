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
  CASE
    WHEN (
      (mr.with_shipping = TRUE)
      AND (
        EXISTS (
          SELECT
            1
          FROM
            "ConfigRentalManagement" crm
          WHERE
            (
              (crm.key = 'Email du livreur' :: text)
              AND (crm.value <> '' :: text)
            )
        )
      )
    ) THEN array_append(
      mr.guests,
      (
        SELECT
          crm.value
        FROM
          "ConfigRentalManagement" crm
        WHERE
          (crm.key = 'Email du livreur' :: text)
        LIMIT
          1
      )
    )
    ELSE mr.guests
  END AS guests,
  mr.deposit,
  mr.with_shipping,
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
  END AS next_maintenance
FROM
  "MachineRented" mr;