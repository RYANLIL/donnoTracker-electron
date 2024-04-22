import { IconButton, InputAdornment, Stack, TextField } from "@mui/material";
import { IDonationRecord } from "models/Persons";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import { useState } from "react";
import { DeleteForever } from "@mui/icons-material";

interface IDonationItem {
  setDonationRecs: React.Dispatch<React.SetStateAction<IDonationRecord[]>>;
  dRec: IDonationRecord;
  donationRecs: IDonationRecord[];
}
export default function DonationItem(props: IDonationItem) {
  const [amount, setAmount] = useState(props.dRec.amount?.toString());
  const [isValid, setIsValid] = useState(true);
  const [helperText, setHelperText] = useState("");

  function handleDateChange(e: Dayjs | any) {
    const date = e.format("YYYY-MM-DD");
    console.log(date);
    const updatedDonations = props.donationRecs.map((rec) => {
      if (rec.id === props.dRec.id) {
        return { ...rec, date: date }; // gets everything that was already in rec and updates the date
      }
      return rec; //returns un modified item
    });
    props.setDonationRecs(updatedDonations);
  }

  function amountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { id, value } = e.target;
    console.log(`id:${id}`, `value:${value}`);
    setAmount(value);

    //Validate if value is a dollar amount
    const re = /^(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{2})?$/;
    if (re.test(value)) {
      setIsValid(true);
      setHelperText("");
      const updatedDonations = props.donationRecs.map((rec) => {
        if (rec.id === props.dRec.id) {
          return { ...rec, amount: +value }; // gets everything that was already in rec and casts value to number and updates amount
        }
        return rec; //returns un modified item
      });
      props.setDonationRecs(updatedDonations);
    } else {
      setIsValid(false);
      setHelperText("Not a valid dollar amount");
    }
  }
  function handleDeleteRecord(dRec: IDonationRecord) {
    console.log(dRec);
    //If id is negative remove
    if (dRec.id < 0) {
      const filteredList = props.donationRecs.filter(
        (rec) => rec.id !== dRec.id
      );
      props.setDonationRecs(filteredList);
    }
  }
  return (
    <Stack direction="row" spacing={2} alignItems={"center"}>
      <TextField
        label="Amount"
        error={!isValid}
        id={props.dRec.id?.toString()}
        value={amount || ""}
        onChange={amountChange}
        InputProps={{
          startAdornment: <InputAdornment position="start">$</InputAdornment>,
        }}
        helperText={helperText}
        color={props.dRec.id < 0 ? "secondary" : "primary"}
        focused={props.dRec.id < 0}
      />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePicker
          label="Date"
          onChange={handleDateChange}
          value={dayjs(props.dRec.date)}
          slotProps={{
            openPickerButton: {
              color: props.dRec.id < 0 ? "secondary" : "primary",
            },
            textField: {
              color: props.dRec.id < 0 ? "secondary" : "primary",
              focused: props.dRec.id < 0,
            },
          }}
        />
      </LocalizationProvider>
      <IconButton onClick={() => handleDeleteRecord(props.dRec)}>
        <DeleteForever />
      </IconButton>
    </Stack>
  );
}
