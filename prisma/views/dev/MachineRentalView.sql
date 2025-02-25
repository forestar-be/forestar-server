SELECT
  mr.id,
  mr."machineRentedId",
  mr."rentalDate",
  mr."returnDate",
  mr."clientAddress",
  mr."clientCity",
  mr."clientEmail",
  mr."clientFirstName",
  mr."clientLastName",
  mr."clientPhone",
  mr."clientPostal",
  mr.paid,
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
    ) THEN ARRAY(
      SELECT DISTINCT UNNEST(
        array_append(
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
      )
    )
    ELSE ARRAY(SELECT DISTINCT UNNEST(mr.guests))
  END AS guests,
  mr."eventId",
  mr.with_shipping
FROM
  "MachineRental" mr;