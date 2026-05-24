-- AlterTable
ALTER TABLE "order_dispatches" ADD COLUMN     "airline_code" TEXT,
ADD COLUMN     "container_number" TEXT,
ADD COLUMN     "courier_name" TEXT,
ADD COLUMN     "courier_phone" TEXT,
ADD COLUMN     "driver_name" TEXT,
ADD COLUMN     "driver_phone" TEXT,
ADD COLUMN     "flight_number" TEXT,
ADD COLUMN     "port_of_discharge" TEXT,
ADD COLUMN     "port_of_loading" TEXT,
ADD COLUMN     "truck_number" TEXT,
ADD COLUMN     "vessel_name" TEXT;
