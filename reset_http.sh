#! /bin/bash

#Remove the rate control/delay
DEV=lo
sudo tc qdisc del dev $DEV root

DEV=eth0
sudo tc qdisc del dev $DEV root

DEV=eth1
sudo tc qdisc del dev $DEV root