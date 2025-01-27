import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { remote } from "electron";
import * as React from "react";
import { useStyles } from "../styles/styles";

export default function ({
  value,
  onChange,
  audioAssetPath,
}: {
  value: string;
  onChange: (newValue: string) => void;
  audioAssetPath: string;
}) {
  const classes = useStyles();

  return (
    <FormControl style={{ width: "100%", margin: "6px 0" }} variant="standard">
      <InputLabel htmlFor="audio" className={classes.label}>
        音源
      </InputLabel>
      <Select
        value={0}
        onClick={() => {
          const result = remote.dialog.showOpenDialogSync({
            defaultPath: audioAssetPath,
            filters: [{ name: "音源", extensions: ["mp3", "wav"] }],
          });
          if (result) onChange(result[0].split(/[\/\\]/).pop()!);
        }}
        inputProps={{ disabled: true }}
      >
        <MenuItem value="0">{value || <em>None</em>}</MenuItem>
      </Select>
    </FormControl>
  );
}
