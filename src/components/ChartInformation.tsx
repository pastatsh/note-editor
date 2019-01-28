import {
  Menu,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  WithStyles,
  withStyles
} from "@material-ui/core";
import * as _ from "lodash";
import * as React from "React";
import Chart from "../stores/Chart";
import styles from "../styles/styles";

interface IProps extends WithStyles<typeof styles> {
  chart: Chart;
  open: boolean;
  onClose: any;
  anchorEl: HTMLElement;
}

export default withStyles(styles)((props: IProps) => {
  if (!props.chart) return <div />;

  // type でグループ化したノーツ
  const map = _.groupBy(props.chart.timeline.notes, "type");

  return (
    <Menu open={props.open} onClose={props.onClose} anchorEl={props.anchorEl}>
      <Table className={props.classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>合計</TableCell>
            {[...Object.keys(map)].map(key => (
              <TableCell align="right" key={key}>
                {key}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>{props.chart.timeline.notes.length}</TableCell>
            {[...Object.entries(map)].map(([key, notes]) => (
              <TableCell align="right" key={key}>
                {notes.length}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </Menu>
  );
});