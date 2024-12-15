SELECT
  mr.id,
  mr.name,
  mr.maintenance_type,
  mr.nb_day_before_maintenance,
  mr.nb_rental_before_maintenance,
  mr.last_maintenance_date,
  mr.eventId,
  CASE
    WHEN (
      (
        mr.maintenance_type = 'BY_DAY' :: "MaintenanceType"
      )
      AND (mr.last_maintenance_date IS NOT NULL)
      AND (mr.nb_day_before_maintenance IS NOT NULL)
    ) THEN (
      mr.last_maintenance_date + (
        (mr.nb_day_before_maintenance) :: double precision * '1 day' :: INTERVAL
      )
    )
    WHEN (
      mr.maintenance_type = 'BY_NB_RENTAL' :: "MaintenanceType"
    ) THEN (
      CASE
        WHEN (
          SELECT
            COUNT(*)
          FROM
            "MachineRental"
          WHERE
            "MachineRental"."machineRentedId" = mr.id
            AND "MachineRental"."rentalDate" > mr.last_maintenance_date
        ) >= mr.nb_rental_before_maintenance THEN (
          SELECT
            max("MachineRental"."returnDate")
          FROM
            "MachineRental"
          WHERE
            "MachineRental"."machineRentedId" = mr.id
        )
        ELSE NULL
      END
    )
    ELSE NULL :: timestamp without time zone
  END AS next_maintenance
FROM
  "MachineRented" mr;