import React from "react";
import { AlertCircle } from "lucide-react";

const ErrorMessage = ({ message }) => {
  return (
    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4 rounded shadow-md dark:bg-red-900 dark:text-red-100 dark:border-red-700">
      <div className="flex items-center">
        <AlertCircle className="mr-2" />
        <p className="font-semibold">Error</p>
      </div>
      <p className="mt-2">{message}</p>
    </div>
  );
};

export default ErrorMessage;
